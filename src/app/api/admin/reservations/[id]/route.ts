import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

const ALLOWED_STATUSES = new Set([
  'pendente',
  'pago',
  'atrasado',
  'cancelado',
  'estornado',
  'expirado',
]);
const ALLOWED_METHODS = new Set([
  'INFINITEPAY',
  'PIX',
  'CREDIT_CARD',
  'BOLETO',
  'DINHEIRO',
  'TRANSFERENCIA',
  'CORTESIA',
  'SALDO_E_PONTOS',
]);

type ReservationUpdate = {
  status_pagamento?: string;
  valor_pago?: number;
  metodo_pagamento?: string;
  motivo?: string;
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Reserva inválida' }, { status: 400 });
  }

  const parsed = await readJsonBody<ReservationUpdate>(request, 20_000);
  if (parsed.response) return parsed.response;

  const status = String(parsed.data.status_pagamento || '').toLowerCase();
  const method = String(parsed.data.metodo_pagamento || '').toUpperCase();
  const amount = Number(parsed.data.valor_pago);
  const reason = String(parsed.data.motivo || '').trim();

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Status de pagamento inválido' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return NextResponse.json({ error: 'Valor pago inválido' }, { status: 400 });
  }
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: 'Método de pagamento inválido' }, { status: 400 });
  }
  if (reason.length > 500) {
    return NextResponse.json({ error: 'Observação muito longa' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: current, error: currentError } = await supabase
    .from('reservas')
    .select('id, status_pagamento, valor_pago, metodo_pagamento, nsu_transacao, client_id, agenda_id')
    .eq('id', id)
    .maybeSingle();
  if (currentError || !current) {
    return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
  }

  const normalizedAmount = Math.round(amount * 100) / 100;
  const { data: pointReconciliation, error: reconciliationError } = await supabase.rpc(
    'admin_update_reservation_payment',
    {
      p_reservation_id: id,
      p_status: status,
      p_amount: normalizedAmount,
      p_method: method,
    },
  );
  if (reconciliationError) {
    console.error('Falha ao reconciliar reserva e pontos:', reconciliationError);
    return NextResponse.json({ error: 'Não foi possível atualizar a reserva e os pontos' }, { status: 400 });
  }

  const { data: reservation, error } = await supabase
    .from('reservas')
    .select('*, clients!reservas_client_id_fkey(*)')
    .eq('id', id)
    .single();
  if (error) {
    return NextResponse.json({ error: 'Não foi possível atualizar a reserva' }, { status: 400 });
  }

  await supabase.from('audit_logs').insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: 'reservation.financial_update',
    resource_type: 'reserva',
    resource_id: id,
    metadata: {
      before: {
        status_pagamento: current.status_pagamento,
        valor_pago: current.valor_pago,
        metodo_pagamento: current.metodo_pagamento,
      },
      after: {
        status_pagamento: status,
        valor_pago: normalizedAmount,
        metodo_pagamento: method,
      },
      reason: reason || null,
      asaasPaymentId: current.nsu_transacao || null,
      points: pointReconciliation,
    },
  });

  return NextResponse.json({
    reservation,
    points: pointReconciliation,
    warning: current.nsu_transacao
      ? 'A alteração foi registrada no painel, mas não modifica nem estorna a cobrança existente no provedor de pagamento.'
      : null,
  });
}
