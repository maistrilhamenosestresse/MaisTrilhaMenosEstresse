import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Agenda inválida' }, { status: 400 });
  const { count, error } = await createSupabaseAdmin().from('reservas')
    .select('id', { count: 'exact', head: true })
    .eq('agenda_id', id)
    .in('status_pagamento', ['pago', 'pendente']);
  if (error) return NextResponse.json({ error: 'Falha ao consultar vagas' }, { status: 500 });
  return NextResponse.json({ reserved: count || 0 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Agenda inválida' }, { status: 400 });
  const { error } = await createSupabaseAdmin().rpc('increment_agenda_views', { p_agenda_id: id });
  if (error) return NextResponse.json({ error: 'Falha ao registrar visualização' }, { status: 500 });
  return NextResponse.json({ success: true });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
