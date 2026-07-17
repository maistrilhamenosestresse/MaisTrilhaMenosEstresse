import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { verifyAndProcessInfinitePayPayment } from '@/lib/server/infinitepay-payment-processing';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

type StatusBody = {
  order_nsu?: string;
  transaction_nsu?: string;
  slug?: string;
  receipt_url?: string;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<StatusBody>(request, 20_000);
  if (parsed.response) return parsed.response;

  const orderNsu = safeIdentifier(parsed.data.order_nsu, 100);
  if (!orderNsu) {
    return NextResponse.json({ error: 'Pedido InfinitePay inválido' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  let { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();
  if (!client && auth.user.email) {
    const result = await supabase
      .from('clients')
      .select('id')
      .ilike('email', auth.user.email)
      .limit(1)
      .maybeSingle();
    client = result.data;
  }
  if (!client) return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 403 });

  const { data: checkout, error: checkoutError } = await supabase
    .from('infinitepay_checkouts')
    .select('status, client_id, capture_method, receipt_url')
    .eq('order_nsu', orderNsu)
    .maybeSingle();
  if (checkoutError) throw checkoutError;
  if (!checkout || checkout.client_id !== client.id) {
    return NextResponse.json({ error: 'Checkout não encontrado' }, { status: 404 });
  }
  if (checkout.status === 'paid') {
    return NextResponse.json({
      success: true,
      paid: true,
      captureMethod: checkout.capture_method,
      receiptUrl: checkout.receipt_url,
    });
  }

  const transactionNsu = safeIdentifier(parsed.data.transaction_nsu, 150);
  const slug = safeIdentifier(parsed.data.slug, 150);
  if (!transactionNsu || !slug) {
    return NextResponse.json({
      success: true,
      paid: false,
      message: 'Aguardando confirmação da InfinitePay',
    });
  }

  try {
    const result = await verifyAndProcessInfinitePayPayment(supabase, {
      orderNsu,
      transactionNsu,
      slug,
      receiptUrl: parsed.data.receipt_url,
    });
    return NextResponse.json({
      success: true,
      paid: result.paid,
      captureMethod: result.captureMethod,
      receiptUrl: result.receiptUrl,
    });
  } catch (error: any) {
    console.error('Erro ao consultar checkout InfinitePay:', error);
    return NextResponse.json(
      { error: error.message || 'Não foi possível confirmar o pagamento' },
      { status: 502 },
    );
  }
}

function safeIdentifier(value: unknown, maxLength: number) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength || !/^[a-zA-Z0-9._:-]+$/.test(normalized)) {
    return '';
  }
  return normalized;
}
