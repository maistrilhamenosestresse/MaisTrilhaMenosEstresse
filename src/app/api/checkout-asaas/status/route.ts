import { NextResponse } from "next/server";
import { getAsaasPayment } from "@/lib/asaas";
import { requireAuthenticatedUser, resolveAuthenticatedClient } from "@/lib/server/auth";
import {
  getAsaasInstallmentProgress,
  processCanceledAsaasPayment,
  processConfirmedAsaasPayment,
} from "@/lib/server/asaas-payment-processing";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

const CONFIRMED_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const paymentId = new URL(request.url).searchParams.get("paymentId") || "";
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    return NextResponse.json({ error: "Pagamento inválido" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const client = await resolveAuthenticatedClient(auth.user);
  if (!client) {
    return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });
  }

  const { data: record } = await supabase
    .from("asaas_payments")
    .select("id, client_id, reference, status")
    .eq("id", paymentId)
    .eq("client_id", client.id)
    .maybeSingle();
  if (!record) {
    return NextResponse.json({ error: "Pagamento não pertence a este cadastro" }, { status: 403 });
  }

  try {
    const payment = await getAsaasPayment(paymentId);
    payment.externalReference ||= record.reference;
    const status = String(payment.status || record.status || "PENDING");
    const installment = await getAsaasInstallmentProgress(payment);
    const confirmed = installment
      ? installment.complete
      : CONFIRMED_STATUSES.has(status);
    let processed = false;

    if (confirmed || CONFIRMED_STATUSES.has(status)) {
      const outcome = await processConfirmedAsaasPayment(supabase, payment);
      processed = outcome === "completed" || outcome === "duplicate";
    } else {
      const event = cancellationEvent(status);
      if (event) {
        await processCanceledAsaasPayment(supabase, payment, event);
        processed = true;
      }
    }

    await supabase.from("asaas_payments").update({
      status,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);

    const { data: reservations } = await supabase
      .from("reservas")
      .select("id, status_pagamento")
      .eq("nsu_transacao", paymentId);

    return NextResponse.json({
      paymentId,
      status,
      confirmed,
      processed,
      installment: installment ? {
        count: installment.installmentCount,
        paid: installment.paidInstallments,
        paidValue: installment.paidValue,
        totalValue: installment.totalValue,
      } : null,
      reservations: reservations || [],
    });
  } catch (error: any) {
    console.error("Erro ao consultar pagamento Asaas:", error);
    return NextResponse.json({
      error: "Não foi possível consultar o pagamento",
    }, { status: 502 });
  }
}

function cancellationEvent(status: string) {
  if (status === "OVERDUE") return "PAYMENT_OVERDUE";
  if (status === "DELETED") return "PAYMENT_DELETED";
  if (["REFUNDED", "PARTIALLY_REFUNDED"].includes(status)) return "PAYMENT_REFUNDED";
  if (status === "CHARGEBACK_REQUESTED") return "PAYMENT_CHARGEBACK_REQUESTED";
  return null;
}
