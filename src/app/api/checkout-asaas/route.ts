import { randomUUID } from "node:crypto";
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
import { processConfirmedAsaasPayment } from "@/lib/server/asaas-payment-processing";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

export const dynamic = "force-dynamic";

type CheckoutBody = {
  reserva_ids?: string[];
  customer_data?: { postalCode?: string; addressNumber?: string };
  payment_method?: "INFINITEPAY" | "PIX" | "CREDIT_CARD" | "BOLETO";
  installments?: number;
  checkout_source?: "site" | "app";
  use_cashback?: boolean;
  use_points?: boolean;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<CheckoutBody>(request, 100_000);
  if (parsed.response) return parsed.response;

  const reservationIds = [...new Set(parsed.data.reserva_ids || [])];
  const requestedMethod = parsed.data.payment_method;
  const paymentMethod = requestedMethod === "BOLETO" ? "BOLETO" : "INFINITEPAY";
  const installments = Number(parsed.data.installments || 1);
  const isAppCheckout = parsed.data.checkout_source === "app";
  if (
    !reservationIds.length ||
    reservationIds.length > 20 ||
    reservationIds.some((id) => !isUuid(id)) ||
    !requestedMethod ||
    !["INFINITEPAY", "PIX", "CREDIT_CARD", "BOLETO"].includes(requestedMethod) ||
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > 12 ||
    (paymentMethod !== "BOLETO" && installments !== 1)
  ) {
    return NextResponse.json(
      { error: "Dados do pagamento inválidos" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdmin();
  const principal = await resolveAuthenticatedClient(auth.user);
  if (!principal) {
    return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 403 });
  }

  const { data: reservations, error: reservationError } = await supabase
    .from("reservas")
    .select("id, agenda_id, status_pagamento, checkout_owner_id, checkout_batch_id, nsu_transacao, purchase_channel")
    .in("id", reservationIds);
  if (reservationError || !reservations || reservations.length !== reservationIds.length) {
    return NextResponse.json({ error: "Reservas não encontradas" }, { status: 404 });
  }

  const batchIds = new Set(reservations.map((item) => item.checkout_batch_id).filter(Boolean));
  if (
    batchIds.size !== 1 ||
    reservations.some((item) =>
      item.checkout_owner_id !== principal.id ||
      item.status_pagamento !== "pendente" ||
      item.nsu_transacao
    )
  ) {
    return NextResponse.json(
      { error: "Lote de reservas já processado ou não autorizado" },
      { status: 409 },
    );
  }
  if (isAppCheckout && reservations.some((item) => item.purchase_channel !== "app")) {
    return NextResponse.json(
      { error: "Os benefícios só podem ser usados em reservas iniciadas pelo aplicativo" },
      { status: 409 },
    );
  }

  const agendaIds = [...new Set(reservations.map((item) => item.agenda_id))];
  const { data: agendas, error: agendaError } = await supabase
    .from("agendas")
    .select("id, title, price, taxa_gratis, accepted_payment_methods")
    .in("id", agendaIds);
  if (agendaError || !agendas || agendas.length !== agendaIds.length) {
    return NextResponse.json({ error: "Trilhas não encontradas" }, { status: 404 });
  }
  if (agendas.some((agenda) => {
    const accepted = Array.isArray(agenda.accepted_payment_methods) &&
      agenda.accepted_payment_methods.length
      ? agenda.accepted_payment_methods
      : ["PIX"];
    return paymentMethod === "BOLETO"
      ? !accepted.includes("BOLETO")
      : !accepted.some((method: string) => ["PIX", "CREDIT_CARD"].includes(method));
  })) {
    return NextResponse.json(
      { error: "Forma de pagamento não aceita para uma das trilhas" },
      { status: 400 },
    );
  }

  const netTotal = reservations.reduce((sum, reservation) => {
    const agenda = agendas.find((item) => item.id === reservation.agenda_id);
    return sum + Number(agenda?.price || 0);
  }, 0);
  if (!Number.isFinite(netTotal) || netTotal <= 0) {
    return NextResponse.json({ error: "Preço inválido" }, { status: 400 });
  }

  const originalValueUpdates = await Promise.all(reservations.map((reservation) => {
    const agenda = agendas.find((item) => item.id === reservation.agenda_id);
    return supabase
      .from("reservas")
      .update({ valor_original: Number(agenda?.price || 0) })
      .eq("id", reservation.id)
      .eq("status_pagamento", "pendente");
  }));
  if (originalValueUpdates.some((result) => result.error)) {
    return NextResponse.json(
      { error: "Não foi possível registrar o valor da venda" },
      { status: 500 },
    );
  }

  const postalCode = String(parsed.data.customer_data?.postalCode || "").replace(/\D/g, "");
  const addressNumber = String(parsed.data.customer_data?.addressNumber || "").trim();
  const attemptId = randomUUID();
  let claimed = false;
  let benefitId: string | null = null;
  let asaasPaymentId: string | null = null;
  let asaasInstallmentId: string | null = null;
  let asaasRecordCreated = false;
  let infinitePayOrderNsu: string | null = null;

  try {
    let netAmountDue = netTotal;
    let benefitSummary: Record<string, unknown> | null = null;
    if (isAppCheckout) {
      const prepared = await supabase.rpc("prepare_app_trail_checkout", {
        p_reservation_ids: reservationIds,
        p_owner_id: principal.id,
        p_gross_amount: netTotal,
        p_use_cashback: parsed.data.use_cashback === true,
        p_use_points: parsed.data.use_points === true,
      });
      if (prepared.error) {
        return NextResponse.json({ error: prepared.error.message }, { status: 409 });
      }
      benefitSummary = prepared.data as Record<string, unknown>;
      benefitId = String(benefitSummary.benefit_id);
      netAmountDue = Number(benefitSummary.amount_due || 0);
    }

    const claim = await supabase.rpc("claim_reservation_checkout", {
      p_reservation_ids: reservationIds,
      p_owner_id: principal.id,
      p_attempt_id: attemptId,
    });
    if (claim.error) {
      if (benefitId) {
        await supabase.rpc("release_app_trail_checkout", { p_benefit_id: benefitId });
      }
      return NextResponse.json({ error: claim.error.message }, { status: 409 });
    }
    claimed = true;

    const trailReference = benefitId
      ? `TRILHA_APP:${benefitId}`
      : `TRILHA:${claim.data}`;

    if (benefitId && netAmountDue <= 0) {
      const internalPaymentId = `INTERNAL:${benefitId}`;
      await processConfirmedAsaasPayment(supabase, {
        id: internalPaymentId,
        externalReference: trailReference,
        value: 0,
        billingType: "SALDO_E_PONTOS",
      });
      claimed = false;
      return NextResponse.json({
        success: true,
        provider: "INTERNAL",
        type: "INTERNAL",
        paymentId: internalPaymentId,
        status: "CONFIRMED",
        benefits: benefitSummary,
      });
    }

    if (paymentMethod === "INFINITEPAY") {
      const checkout = await createInfinitePayCheckout({
        kind: "trail",
        reference: trailReference,
        clientId: principal.id,
        netAmount: netAmountDue,
        description: `Mais Trilha - ${reservations.length} vaga(s)`,
        customer: principal,
      });
      infinitePayOrderNsu = checkout.orderNsu;
      const pendingPaymentId = `IP:${checkout.orderNsu}`;

      const reservationUpdate = await supabase
        .from("reservas")
        .update({
          nsu_transacao: pendingPaymentId,
          metodo_pagamento: "INFINITEPAY",
        })
        .in("id", reservationIds)
        .eq("nsu_transacao", `CREATING:${attemptId}`);
      if (reservationUpdate.error) throw reservationUpdate.error;

      if (benefitId) {
        const attached = await supabase.rpc("attach_app_trail_payment", {
          p_benefit_id: benefitId,
          p_payment_id: pendingPaymentId,
        });
        if (attached.error) throw attached.error;
      }
      claimed = false;

      return NextResponse.json({
        success: true,
        provider: "INFINITEPAY",
        type: "INFINITEPAY",
        redirectUrl: checkout.redirectUrl,
        orderNsu: checkout.orderNsu,
        netAmount: checkout.netAmount,
        benefits: benefitSummary,
      });
    }

    const charge = await createAsaasCharge({
      client: principal,
      method: "BOLETO",
      netAmount: netAmountDue,
      absorbFee: agendas.every((agenda) => agenda.taxa_gratis === true),
      reference: trailReference,
      description: `Mais Trilha - ${reservations.length} vaga(s)`,
      installments,
      postalCode: postalCode || undefined,
      addressNumber: addressNumber || undefined,
    });
    asaasPaymentId = String(charge.payment.id);
    asaasInstallmentId = charge.installmentId;

    const paymentRecord = await supabase.from("asaas_payments").upsert(charge.payments.map((payment: any) => ({
      id: String(payment.id),
      kind: "trail",
      reference: trailReference,
      client_id: principal.id,
      status: payment.status || "PENDING",
      amount: Number(payment.value || 0),
      updated_at: new Date().toISOString(),
    })));
    if (paymentRecord.error) throw paymentRecord.error;
    asaasRecordCreated = true;

    const reservationUpdate = await supabase
      .from("reservas")
      .update({
        nsu_transacao: asaasPaymentId,
        metodo_pagamento: paymentMethod,
      })
      .in("id", reservationIds)
      .eq("nsu_transacao", `CREATING:${attemptId}`);
    if (reservationUpdate.error) throw reservationUpdate.error;

    if (benefitId) {
      const attached = await supabase.rpc("attach_app_trail_payment", {
        p_benefit_id: benefitId,
        p_payment_id: asaasPaymentId,
      });
      if (attached.error) throw attached.error;
    }
    claimed = false;

    return NextResponse.json({
      ...charge.response,
      benefits: benefitSummary,
    });
  } catch (error: any) {
    await safelyCancelAsaasPayment(asaasPaymentId, asaasInstallmentId);
    if (asaasRecordCreated && asaasPaymentId) {
      await supabase.from("asaas_payments").update({
        status: "DELETED",
        updated_at: new Date().toISOString(),
      }).eq("id", asaasPaymentId);
    }
    if (claimed) {
      await supabase.rpc("release_reservation_checkout_claim", {
        p_reservation_ids: reservationIds,
        p_attempt_id: attemptId,
      });
    }
    if (benefitId) {
      await supabase.rpc("release_app_trail_checkout", { p_benefit_id: benefitId });
    }
    await failInfinitePayCheckout(infinitePayOrderNsu);
    console.error("Erro no checkout híbrido:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao processar pagamento" },
      { status: 502 },
    );
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
