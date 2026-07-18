import { NextResponse } from "next/server";
import {
  createAsaasCharge,
  safelyCancelAsaasPayment,
} from "@/lib/server/asaas-checkout";
import {
  createInfinitePayCheckout,
  failInfinitePayCheckout,
} from "@/lib/server/infinitepay-checkout";
import {
  requireAuthenticatedUser,
  resolveAuthenticatedClient,
} from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

export const dynamic = "force-dynamic";

type CheckoutBody = {
  produtoId?: string;
  clientId?: string;
  method?: "infinitepay" | "pix" | "cartao" | "boleto" | "cashback";
  forma_entrega?: "retirada" | "correios" | "entrega_trilha";
  delivery_info?: string;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<CheckoutBody>(request, 100_000);
  if (parsed.response) return parsed.response;

  const input = parsed.data;
  const requestedMethod = input.method || "infinitepay";
  const deliveryMethod = input.forma_entrega || "retirada";
  if (
    !isUuid(input.produtoId || "") ||
    !isUuid(input.clientId || "") ||
    !["infinitepay", "pix", "cartao", "boleto", "cashback"].includes(requestedMethod) ||
    !["retirada", "correios", "entrega_trilha"].includes(deliveryMethod)
  ) {
    return NextResponse.json({ error: "Dados do pedido inválidos" }, { status: 400 });
  }
  const deliveryInfo = String(input.delivery_info || "").trim().slice(0, 1000);
  if (deliveryMethod !== "retirada" && deliveryInfo.length < 5) {
    return NextResponse.json({ error: "Informe os dados de entrega" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const [client, productResult] = await Promise.all([
    resolveAuthenticatedClient(auth.user),
    supabase.from("produtos").select("id, active").eq("id", input.produtoId).maybeSingle(),
  ]);
  const product = productResult.data;
  if (!client || client.id !== input.clientId || !product?.active) {
    return NextResponse.json({ error: "Cliente ou produto não encontrado" }, { status: 404 });
  }

  let orderId: string | null = null;
  let asaasPaymentId: string | null = null;
  let infinitePayOrderNsu: string | null = null;
  try {
    const { data: order, error: orderError } = await supabase.rpc("create_store_order", {
      p_client_id: client.id,
      p_product_id: input.produtoId,
      p_delivery_method: deliveryMethod,
      p_delivery_info: deliveryInfo,
    });
    if (orderError) throw orderError;
    orderId = String(order.order_id);
    const amountDue = Number(order.amount_due);
    if (order.paid || amountDue <= 0) {
      return NextResponse.json({
        success: true,
        provider: "INTERNAL",
        type: "CASHBACK_FULL",
        orderId,
      });
    }
    if (requestedMethod === "cashback") {
      throw new Error("O saldo e os pontos não cobrem o valor total do produto");
    }

    if (requestedMethod !== "boleto") {
      const checkout = await createInfinitePayCheckout({
        kind: "store",
        reference: `LOJA:${orderId}`,
        clientId: client.id,
        netAmount: amountDue,
        description: `Mais Trilha - Pedido #${orderId.slice(0, 8)}`,
        customer: client,
      });
      infinitePayOrderNsu = checkout.orderNsu;
      const pendingPaymentId = `IP:${checkout.orderNsu}`;
      const orderUpdate = await supabase
        .from("pedidos_loja")
        .update({
          payment_id: pendingPaymentId,
          metodo_pagamento: "INFINITEPAY",
        })
        .eq("id", orderId)
        .eq("status_pagamento", "pendente");
      if (orderUpdate.error) throw orderUpdate.error;

      return NextResponse.json({
        success: true,
        provider: "INFINITEPAY",
        type: "INFINITEPAY",
        redirectUrl: checkout.redirectUrl,
        orderNsu: checkout.orderNsu,
        orderId,
        netAmount: checkout.netAmount,
      });
    }

    const charge = await createAsaasCharge({
      client,
      method: "BOLETO",
      netAmount: amountDue,
      reference: `LOJA:${orderId}`,
      description: `Mais Trilha - Pedido #${orderId.slice(0, 8)}`,
    });
    asaasPaymentId = String(charge.payment.id);

    const paymentRecord = await supabase.from("asaas_payments").upsert({
      id: asaasPaymentId,
      kind: "store",
      reference: `LOJA:${orderId}`,
      client_id: client.id,
      status: charge.payment.status || "PENDING",
      amount: charge.chargedAmount,
      updated_at: new Date().toISOString(),
    });
    if (paymentRecord.error) throw paymentRecord.error;

    const orderUpdate = await supabase
      .from("pedidos_loja")
      .update({
        payment_id: asaasPaymentId,
        metodo_pagamento: "BOLETO",
      })
      .eq("id", orderId)
      .eq("status_pagamento", "pendente");
    if (orderUpdate.error) throw orderUpdate.error;

    return NextResponse.json({
      ...charge.response,
      orderId,
    });
  } catch (error: any) {
    await safelyCancelAsaasPayment(asaasPaymentId);
    await failInfinitePayCheckout(infinitePayOrderNsu);
    if (asaasPaymentId) {
      await supabase.from("asaas_payments").update({
        status: "DELETED",
        updated_at: new Date().toISOString(),
      }).eq("id", asaasPaymentId);
    }
    if (orderId) {
      await supabase.rpc("cancel_store_order", {
        p_order_id: orderId,
        p_payment_id: asaasPaymentId || `ORDER:${orderId}`,
        p_status: "cancelado",
      });
    }
    console.error("Erro no checkout híbrido da loja:", error);
    return NextResponse.json(
      { error: error.message || "Falha no checkout" },
      { status: 502 },
    );
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
