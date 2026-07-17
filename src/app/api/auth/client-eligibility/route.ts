import { NextResponse } from 'next/server';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { hasMemberAccess, REQUIRED_PAID_TRAILS } from '@/lib/member-access';

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, 'client-eligibility', 10, 600);
  if (rateLimit) return rateLimit;
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const parsed = await readJsonBody<{ email?: string }>(request, 10_000);
  if (parsed.response) return parsed.response;
  const email = parsed.data.email?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ registered: false, eligible: false, requiredPaidTrails: REQUIRED_PAID_TRAILS });
  }

  const supabase = createSupabaseAdmin();
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, membro_vip')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (clientError) {
    console.error('Falha ao verificar cadastro para acesso ao app:', clientError.message);
    return NextResponse.json({ error: 'Não foi possível verificar o acesso agora.' }, { status: 500 });
  }

  if (!client) {
    return NextResponse.json({ registered: false, eligible: false, requiredPaidTrails: REQUIRED_PAID_TRAILS });
  }

  const { count, error: reservationError } = await supabase
    .from('reservas')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id).eq('status_pagamento', 'pago');

  if (reservationError) {
    console.error('Falha ao contar trilhas pagas para acesso ao app:', reservationError.message);
    return NextResponse.json({ error: 'Não foi possível verificar o acesso agora.' }, { status: 500 });
  }

  return NextResponse.json({
    registered: true,
    eligible: hasMemberAccess(count || 0, client.membro_vip === true),
    requiredPaidTrails: REQUIRED_PAID_TRAILS,
  });
}
