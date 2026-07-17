import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: agendas, error: agendaError } = await supabase
    .from('agendas')
    .select('id')
    .gte('date', today);

  if (agendaError) {
    return NextResponse.json({ error: 'Falha ao consultar agendas' }, { status: 500 });
  }

  const agendaIds = (agendas || []).map((agenda) => agenda.id);
  if (agendaIds.length === 0) {
    return NextResponse.json({ reservedByAgenda: {} });
  }

  const { data: reservations, error: reservationError } = await supabase
    .from('reservas')
    .select('agenda_id')
    .in('agenda_id', agendaIds)
    .in('status_pagamento', ['pago', 'pendente']);

  if (reservationError) {
    return NextResponse.json({ error: 'Falha ao consultar vagas' }, { status: 500 });
  }

  const reservedByAgenda: Record<string, number> = Object.fromEntries(
    agendaIds.map((id) => [id, 0]),
  );

  for (const reservation of reservations || []) {
    if (reservation.agenda_id in reservedByAgenda) {
      reservedByAgenda[reservation.agenda_id] += 1;
    }
  }

  return NextResponse.json(
    { reservedByAgenda },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
