import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAsaasPayment } from '@/lib/asaas';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { processCanceledAsaasPayment, processConfirmedAsaasPayment } from '@/lib/server/asaas-payment-processing';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const FINAL_STATUSES = ['RECEIVED', 'CONFIRMED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DELETED', 'OVERDUE', 'CHARGEBACK_REQUESTED'];

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const received = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !received || !safeEquals(received, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data: records, error } = await supabase.from('asaas_payments')
    .select('*')
    .not('status', 'in', `(${FINAL_STATUSES.map((status) => `"${status}"`).join(',')})`)
    .order('updated_at', { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: 'Falha ao listar pagamentos' }, { status: 500 });

  let checked = 0;
  let processed = 0;
  const failures: Array<{ paymentId: string; error: string }> = [];
  for (const record of records || []) {
    try {
      const payment = await getAsaasPayment(record.id);
      payment.externalReference ||= record.reference;
      checked++;
      if (['RECEIVED', 'CONFIRMED'].includes(payment.status)) {
        await processConfirmedAsaasPayment(supabase, payment);
        processed++;
      } else {
        const event = cancellationEvent(payment.status);
        if (event) {
          await processCanceledAsaasPayment(supabase, payment, event);
          processed++;
        }
      }
      await supabase.from('asaas_payments').update({
        status: payment.status || record.status,
        updated_at: new Date().toISOString(),
      }).eq('id', record.id);
    } catch (err: any) {
      failures.push({ paymentId: record.id, error: String(err.message || err).slice(0, 300) });
    }
  }

  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: staleOrders } = await supabase.from('pedidos_loja').select('id')
    .eq('status_pagamento', 'pendente').is('payment_id', null).lt('created_at', staleCutoff).limit(100);
  for (const order of staleOrders || []) {
    await supabase.rpc('cancel_store_order', {
      p_order_id: order.id,
      p_payment_id: `ORDER:${order.id}`,
      p_status: 'expirado',
    });
  }
  const { count: staleReservations } = await supabase.from('reservas').update({ status_pagamento: 'cancelado' }, { count: 'exact' })
    .eq('status_pagamento', 'pendente').is('nsu_transacao', null).lt('created_at', staleCutoff);

  await supabase.from('audit_logs').insert({
    action: 'asaas.reconcile', resource_type: 'payment_batch',
    metadata: { checked, processed, failures, staleOrders: staleOrders?.length || 0, staleReservations: staleReservations || 0 },
  });
  return NextResponse.json({
    success: failures.length === 0, checked, processed, failures,
    staleOrders: staleOrders?.length || 0, staleReservations: staleReservations || 0,
  });
}

function cancellationEvent(status: string) {
  if (status === 'OVERDUE') return 'PAYMENT_OVERDUE';
  if (status === 'DELETED') return 'PAYMENT_DELETED';
  if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(status)) return 'PAYMENT_REFUNDED';
  if (status === 'CHARGEBACK_REQUESTED') return 'PAYMENT_CHARGEBACK_REQUESTED';
  return null;
}

function safeEquals(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
