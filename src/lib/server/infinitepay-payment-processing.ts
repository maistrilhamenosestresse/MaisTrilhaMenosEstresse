import 'server-only';

import { checkInfinitePayPayment } from '@/lib/server/infinitepay';
import { processConfirmedProviderPayment } from '@/lib/server/asaas-payment-processing';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export async function verifyAndProcessInfinitePayPayment(
  supabase: SupabaseAdmin,
  input: {
    orderNsu: string;
    transactionNsu: string;
    slug: string;
    receiptUrl?: string;
    payload?: Record<string, unknown>;
  },
) {
  const { data: checkout, error } = await supabase
    .from('infinitepay_checkouts')
    .select('*')
    .eq('order_nsu', input.orderNsu)
    .maybeSingle();
  if (error) throw error;
  if (!checkout) throw new Error('Checkout InfinitePay não encontrado');

  if (checkout.status === 'paid') {
    if (checkout.transaction_nsu && checkout.transaction_nsu !== input.transactionNsu) {
      throw new Error('Transação não corresponde ao checkout');
    }
    return {
      paid: true,
      duplicate: true,
      captureMethod: checkout.capture_method,
      receiptUrl: checkout.receipt_url,
    };
  }
  if (!['creating', 'pending'].includes(checkout.status)) {
    throw new Error('Checkout InfinitePay não está ativo');
  }
  if (checkout.transaction_nsu && checkout.transaction_nsu !== input.transactionNsu) {
    throw new Error('Transação divergente para o checkout');
  }
  if (checkout.invoice_slug && checkout.invoice_slug !== input.slug) {
    throw new Error('Fatura divergente para o checkout');
  }

  const verification = await checkInfinitePayPayment({
    orderNsu: input.orderNsu,
    transactionNsu: input.transactionNsu,
    slug: input.slug,
  });
  if (!verification.success || !verification.paid) {
    await supabase
      .from('infinitepay_checkouts')
      .update({
        status: 'pending',
        transaction_nsu: input.transactionNsu,
        invoice_slug: input.slug,
        last_payload: input.payload || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkout.id)
      .neq('status', 'paid');
    return { paid: false, duplicate: false };
  }
  if (verification.amount !== checkout.expected_amount_cents) {
    throw new Error('Valor confirmado pela InfinitePay diverge do pedido');
  }

  const paidValue = verification.amount / 100;
  const customerChargedValue = verification.paid_amount / 100;
  const billingType = verification.capture_method === 'pix'
    ? 'PIX_INFINITEPAY'
    : 'CREDIT_CARD_INFINITEPAY';
  const outcome = await processConfirmedProviderPayment(supabase, {
    reference: checkout.reference,
    paymentId: input.transactionNsu,
    paidValue,
    customerChargedValue,
    billingType,
    provider: 'INFINITEPAY',
  });

  const receiptUrl = sanitizeReceiptUrl(input.receiptUrl);
  const { error: updateError } = await supabase
    .from('infinitepay_checkouts')
    .update({
      status: 'paid',
      transaction_nsu: input.transactionNsu,
      invoice_slug: input.slug,
      capture_method: verification.capture_method,
      paid_amount_cents: verification.paid_amount,
      installments: verification.installments,
      receipt_url: receiptUrl,
      last_payload: input.payload || {},
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkout.id);
  if (updateError) throw updateError;

  return {
    paid: true,
    duplicate: outcome === 'duplicate',
    captureMethod: verification.capture_method,
    receiptUrl,
  };
}

function sanitizeReceiptUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
