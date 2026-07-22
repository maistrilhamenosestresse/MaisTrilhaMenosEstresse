import { NextResponse } from "next/server";
import { requireAuthenticatedUser, resolveAuthenticatedClient } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

type AgendaRow = {
  id: string;
  title: string;
  date: string;
  distance_km: number | null;
  difficulty: string | null;
  flyer_url: string | null;
};

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const client = await resolveAuthenticatedClient(auth.user);
  if (!client) {
    return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });
  }

  const supabase = createSupabaseAdmin();
  const { data: reservations, error: reservationsError } = await supabase
    .from("reservas")
    .select("id, agenda_id, created_at")
    .eq("client_id", client.id)
    .eq("status_pagamento", "pago");
  if (reservationsError) {
    return NextResponse.json({ error: "Não foi possível carregar o passaporte" }, { status: 500 });
  }

  const agendaIds = [...new Set((reservations || []).map((item) => item.agenda_id).filter(Boolean))];
  let agendas: AgendaRow[] = [];
  if (agendaIds.length) {
    const { data, error } = await supabase
      .from("agendas")
      .select("id, title, date, distance_km, difficulty, flyer_url")
      .in("id", agendaIds);
    if (error) {
      return NextResponse.json({ error: "Não foi possível carregar as trilhas do passaporte" }, { status: 500 });
    }
    agendas = (data || []) as AgendaRow[];
  }

  const today = new Date().toISOString().slice(0, 10);
  const completed = agendas
    .filter((agenda) => agenda.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = agendas
    .filter((agenda) => agenda.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const completedCount = completed.length;
  const nextMilestone = Math.max(3, Math.ceil((completedCount + 1) / 3) * 3);

  return NextResponse.json({
    participant: {
      fullName: client.full_name,
      points: Number(client.pontos || 0),
      cashbackBalance: Number(client.cashback_saldo || 0),
    },
    summary: {
      completedCount,
      totalDistanceKm: completed.reduce((total, agenda) => total + Number(agenda.distance_km || 0), 0),
      upcomingCount: upcoming.length,
      nextMilestone,
    },
    completed,
    upcoming,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
