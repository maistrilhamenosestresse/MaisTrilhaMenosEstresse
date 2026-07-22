import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

type ManualReservationInput = {
  agenda_id?: string;
  client_id?: string;
  status_pagamento?: string;
  valor_pago?: number;
  metodo_pagamento?: string;
};

const ALLOWED_STATUSES = new Set(['pendente', 'pago', 'atrasado', 'cancelado', 'estornado', 'expirado']);
const ALLOWED_METHODS = new Set([
  'INFINITEPAY', 'PIX', 'CREDIT_CARD', 'BOLETO', 'DINHEIRO',
  'TRANSFERENCIA', 'CORTESIA', 'SALDO_E_PONTOS',
]);

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const parsed = await readJsonBody<ManualReservationInput>(request, 20_000);
  if (parsed.response) return parsed.response;

  const agendaId = String(parsed.data.agenda_id || '').trim();
  const clientId = String(parsed.data.client_id || '').trim();
  const status = String(parsed.data.status_pagamento || 'pendente').toLowerCase();
  const method = String(parsed.data.metodo_pagamento || 'PIX').toUpperCase();
  const amount = Math.round(Number(parsed.data.valor_pago || 0) * 100) / 100;

  if (!/^[0-9a-f-]{36}$/i.test(agendaId) || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: 'Trilha ou cliente inválido' }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.has(status) || !ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: 'Status ou forma de pagamento inválida' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return NextResponse.json({ error: 'Valor pago inválido' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const [{ data: agenda }, { data: client }, { data: existing }] = await Promise.all([
    supabase.from('agendas').select('id, max_capacity').eq('id', agendaId).maybeSingle(),
    supabase.from('clients').select('id').eq('id', clientId).maybeSingle(),
    supabase.from('reservas').select('id').eq('agenda_id', agendaId).eq('client_id', clientId)
      .in('status_pagamento', ['pendente', 'pago', 'atrasado']).limit(1).maybeSingle(),
  ]);

  if (!agenda || !client) {
    return NextResponse.json({ error: 'Trilha ou cliente não encontrado' }, { status: 404 });
  }
  if (existing) {
    return NextResponse.json({ error: 'Este cliente já possui uma reserva ativa nesta trilha' }, { status: 409 });
  }

  if (status === 'pendente' || status === 'pago' || status === 'atrasado') {
    const { count } = await supabase.from('reservas').select('id', { count: 'exact', head: true })
      .eq('agenda_id', agendaId).in('status_pagamento', ['pendente', 'pago']);
    if ((count || 0) >= Number(agenda.max_capacity || 15)) {
      return NextResponse.json({ error: 'A trilha já atingiu a capacidade máxima' }, { status: 409 });
    }
  }

  const { data: created, error: createError } = await supabase.from('reservas').insert({
    agenda_id: agendaId,
    client_id: clientId,
    status_pagamento: 'pendente',
    valor_pago: 0,
    metodo_pagamento: method,
    purchase_channel: 'admin',
  }).select('id').single();

  if (createError || !created) {
    return NextResponse.json({ error: 'Não foi possível criar a reserva manual' }, { status: 400 });
  }

  const { data: points, error: reconciliationError } = await supabase.rpc(
    'admin_update_reservation_payment',
    {
      p_reservation_id: created.id,
      p_status: status,
      p_amount: amount,
      p_method: method,
    },
  );

  if (reconciliationError) {
    await supabase.from('reservas').delete().eq('id', created.id);
    console.error('Falha ao criar reserva manual e pontuar:', reconciliationError);
    return NextResponse.json({ error: 'Não foi possível registrar a venda manual e os pontos' }, { status: 400 });
  }

  const { data: reservation, error: reservationError } = await supabase
    .from('reservas')
    .select('*, clients!reservas_client_id_fkey(*)')
    .eq('id', created.id)
    .single();

  if (reservationError || !reservation) {
    return NextResponse.json({ error: 'Reserva criada, mas não foi possível recarregar os dados' }, { status: 500 });
  }

  await supabase.from('audit_logs').insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: 'reservation.manual_create',
    resource_type: 'reserva',
    resource_id: created.id,
    metadata: { agenda_id: agendaId, client_id: clientId, status, amount, method, points },
  });

  return NextResponse.json({ reservation, points }, { status: 201 });
}
