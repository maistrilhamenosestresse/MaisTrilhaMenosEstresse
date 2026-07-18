import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import {
  isWebPushConfigured,
  sendPushCampaign,
} from "@/lib/server/push-notifications";

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ success: true, skipped: "web_push_not_configured" });
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);
  const date = targetDate.toISOString().slice(0, 10);
  const supabase = createSupabaseAdmin();
  const { data: agendas, error } = await supabase
    .from("agendas")
    .select("id, title, date, meeting_point")
    .eq("date", date);
  if (error) throw error;

  const results = [];
  for (const agenda of agendas || []) {
    const { data: reservations, error: reservationError } = await supabase
      .from("reservas")
      .select("client_id")
      .eq("agenda_id", agenda.id)
      .eq("status_pagamento", "pago");
    if (reservationError) throw reservationError;
    const clientIds = [...new Set((reservations || []).map((item) => item.client_id).filter(Boolean))];
    if (!clientIds.length) continue;

    results.push(await sendPushCampaign({
      title: "Sua aventura é amanhã! 🥾",
      body: `${agenda.title}. Confira o ponto de encontro e prepare seus equipamentos.`,
      url: `/app/trilhas/${agenda.id}`,
      topic: "reservation_reminders",
      clientIds,
      dedupeKey: `trail-reminder:${agenda.id}:${date}`,
      audience: "paid_reservations",
      tag: `trail-${agenda.id}`,
    }));
  }

  return NextResponse.json({ success: true, date, campaigns: results.length });
}
