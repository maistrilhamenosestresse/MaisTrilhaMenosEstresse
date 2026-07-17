import { NextResponse } from "next/server";
import { getAsaasPayment } from "@/lib/asaas";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { processCanceledAsaasPayment, processConfirmedAsaasPayment } from "@/lib/server/asaas-payment-processing";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

const CONFIRMED_STATUSES = new Set(["RECEIVED", "CONFIRMED"]);

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const paymentId = new URL(request.url).searchParams.get("paymentId") || "";
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    return NextResponse.json({ error: "Pagamento inválido" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  let { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (!client && auth.user.email) {
    const result = await supabase
      .from("clients")
      .select("id")
      .ilike("email", auth.user.email)
      .limit(1)
      .maybeSingle();
    client = result.data;
  }
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
    let processed = false;

    if (CONFIRMED_STATUSES.has(status)) {
      await processConfirmedAsaasPayment(supabase, payment);
      processed = true;
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
      confirmed: CONFIRMED_STATUSES.has(status),
      processed,
      reservations: reservations || [],
    });
  } catch (error: any) {
    console.error("Erro ao consultar pagamento Asaas:", error);
    return NextResponse.json({
      error: error.message || "Não foi possível consultar o pagamento",
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
