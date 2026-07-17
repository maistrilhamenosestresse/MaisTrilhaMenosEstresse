import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { readJsonBody } from '@/lib/server/request';
import { processCanceledAsaasPayment, processConfirmedAsaasPayment } from '@/lib/server/asaas-payment-processing';

export const dynamic = 'force-dynamic';

const CONFIRMED_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const CANCELED_EVENTS = new Set(['PAYMENT_REFUNDED', 'PAYMENT_DELETED', 'PAYMENT_OVERDUE', 'PAYMENT_CHARGEBACK_REQUESTED']);

export async function POST(request: Request) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const receivedToken = request.headers.get('asaas-access-token');
  if (!expectedToken) return NextResponse.json({ error: 'Webhook indisponível' }, { status: 503 });
  if (!receivedToken || !safeTokenEquals(receivedToken, expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await readJsonBody<any>(request, 1_000_000);
  if (parsed.response) return parsed.response;
  const payload = parsed.data;
  const event = String(payload.event || 'UNKNOWN');
  const payment = payload.payment;
  const eventId = String(payload.id || `${event}:${payment?.id || 'NO_PAYMENT'}:${payment?.status || 'NO_STATUS'}`);
  const supabase = createSupabaseAdmin();

  try {
    const { error: insertError } = await supabase.from('asaas_webhook_events').insert({
      event_id: eventId, event_type: event, payment_id: payment?.id || null,
      payload, status: 'processing',
    });
    if (insertError?.code === '23505') return NextResponse.json({ received: true, duplicate: true });
    if (insertError) throw insertError;
    if (!payment?.id || !payment.externalReference) {
      await finishEvent(supabase, eventId, 'ignored');
      return NextResponse.json({ received: true, ignored: true });
    }

    let outcome = 'ignored';
    if (CANCELED_EVENTS.has(event)) {
      outcome = await processCanceledAsaasPayment(supabase, payment, event);
    } else if (CONFIRMED_EVENTS.has(event) || ['RECEIVED', 'CONFIRMED'].includes(payment.status)) {
      outcome = await processConfirmedAsaasPayment(supabase, payment);
    }
    await supabase.from('asaas_payments').update({
      status: String(payment.status || event), updated_at: new Date().toISOString(),
    }).eq('id', payment.id);
    await finishEvent(supabase, eventId, outcome === 'ignored' ? 'ignored' : 'completed');
    return NextResponse.json({ received: true, outcome });
  } catch (error: any) {
    console.error('Erro no webhook Asaas:', error);
    await supabase.from('asaas_webhook_events').update({
      status: 'failed', error_message: String(error.message || error).slice(0, 1000),
      processed_at: new Date().toISOString(),
    }).eq('event_id', eventId);
    return NextResponse.json({ error: 'Falha ao processar webhook' }, { status: 500 });
  }
}

async function finishEvent(supabase: ReturnType<typeof createSupabaseAdmin>, eventId: string, status: 'completed' | 'ignored') {
  await supabase.from('asaas_webhook_events').update({ status, processed_at: new Date().toISOString() }).eq('event_id', eventId);
}

function safeTokenEquals(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
