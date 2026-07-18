import { NextResponse } from "next/server";
import { createInfinitePayCheckout } from "@/lib/server/infinitepay-checkout";
import {
  requireAuthenticatedUser,
  resolveAuthenticatedClient,
} from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

export const dynamic = "force-dynamic";

type RechargeBody = {
  amount?: number | string;
  clientId?: string;
  method?: "infinitepay" | "pix" | "cartao";
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<RechargeBody>(request, 50_000);
  if (parsed.response) return parsed.response;

  const amount = Number(String(parsed.data.amount || "").replace(",", "."));
  const method = parsed.data.method || "infinitepay";
  const clientId = String(parsed.data.clientId || "");
  if (
    !Number.isFinite(amount) ||
    amount < 5 ||
    amount > 5000 ||
    !isUuid(clientId) ||
    !["infinitepay", "pix", "cartao"].includes(method)
  ) {
    return NextResponse.json(
      { error: "Valor, cliente ou forma de pagamento inválida" },
      { status: 400 },
    );
  }

  const client = await resolveAuthenticatedClient(auth.user);
  if (!client || client.id !== clientId) {
    return NextResponse.json({ error: "Cliente não pertence à sessão" }, { status: 403 });
  }

  try {
    const netAmount = Math.round(amount * 100) / 100;
    const reference = `RECARGA:${clientId}:${Math.round(netAmount * 100)}`;
    const checkout = await createInfinitePayCheckout({
      kind: "recharge",
      clientId,
      netAmount,
      reference,
      description: `Mais Trilha - Recarga de saldo de R$ ${netAmount.toFixed(2)}`,
      customer: client,
    });

    return NextResponse.json({
      success: true,
      provider: "INFINITEPAY",
      type: "INFINITEPAY",
      redirectUrl: checkout.redirectUrl,
      orderNsu: checkout.orderNsu,
      netAmount: checkout.netAmount,
      credited: false,
      creditedAmount: netAmount,
      message: "O saldo será creditado após a confirmação oficial da InfinitePay.",
    });
  } catch (error: any) {
    console.error("Erro ao criar recarga InfinitePay:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao criar recarga" },
      { status: 502 },
    );
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
