import { NextResponse } from "next/server";
import { requireAuthenticatedUser, resolveAuthenticatedClient } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getAdventureProgress } from "@/lib/gamification";

export const dynamic = "force-dynamic";

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

  let client = await resolveAuthenticatedClient(auth.user);
  if (!client) {
    return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });
  }

  const supabase = createSupabaseAdmin();
  const { data: released } = await supabase.rpc("release_stale_app_checkouts", {
    p_owner_id: client.id,
  });
  if (Number(released || 0) > 0) {
    const refreshed = await supabase.from("clients").select("*").eq("id", client.id).single();
    if (refreshed.data) client = refreshed.data;
  }

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
  const experience = getAdventureProgress(Number(client.experiencia || 0));
  const { data: experienceHistory } = await supabase
    .from("experience_transactions")
    .select("id, experience, description, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(6);

  return NextResponse.json({
    participant: {
      fullName: client.full_name,
      points: Number(client.pontos || 0),
      experience: experience.experience,
      cashbackBalance: Number(client.cashback_saldo || 0),
      passportNumber: `MT-${String(client.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`,
      issuedAt: client.created_at,
    },
    summary: {
      completedCount,
      totalDistanceKm: completed.reduce((total, agenda) => total + Number(agenda.distance_km || 0), 0),
      upcomingCount: upcoming.length,
      nextMilestone,
      level: experience.current.name,
      levelNumber: experience.levelNumber,
      nextLevel: experience.next?.name || null,
      levelProgress: experience.progress,
      experienceRemaining: experience.remaining,
    },
    completed,
    upcoming,
    experienceHistory: experienceHistory || [],
    releasedCheckouts: Number(released || 0),
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
