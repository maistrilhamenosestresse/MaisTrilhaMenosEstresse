import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createInfinitePayLink } from '@/lib/server/infinitepay';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

type RechargeBody = {
  amount?: number | string;
  clientId?: string;
  method?: 'infinitepay' | 'pix' | 'cartao';
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<RechargeBody>(request, 50_000);
  if (parsed.response) return parsed.response;

  const amount = Number(String(parsed.data.amount || '').replace(',', '.'));
  const method = parsed.data.method || 'infinitepay';
  const clientId = String(parsed.data.clientId || '');
  if (!Number.isFinite(amount) || amount < 5 || amount > 5000 || !isUuid(clientId) ||
      !['infinitepay', 'pix', 'cartao'].includes(method)) {
    return NextResponse.json({ error: 'Valor, cliente ou forma de pagamento inválida' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  const isOwner = client.auth_user_id === auth.user.id || client.email?.toLowerCase() === auth.user.email?.toLowerCase();
  if (!isOwner) return NextResponse.json({ error: 'Cliente não pertence à sessão' }, { status: 403 });

  try {
    const orderNsu = randomUUID();
    const expectedAmountCents = Math.round(amount * 100);
    const reference = `RECARGA:${clientId}`;
    const { error: checkoutInsertError } = await supabase.from('infinitepay_checkouts').insert({
      id: orderNsu,
      order_nsu: orderNsu,
      kind: 'recharge',
      reference,
      client_id: clientId,
      expected_amount_cents: expectedAmountCents,
      status: 'creating',
    });
    if (checkoutInsertError) throw checkoutInsertError;

    try {
      const publicBaseUrl = getPublicBaseUrl(request);
      const link = await createInfinitePayLink({
        orderNsu,
        redirectUrl: `${publicBaseUrl}/pagamento/infinitepay/retorno`,
        webhookUrl: `${publicBaseUrl}/api/webhooks/infinitepay`,
        customer: {
          name: client.full_name,
          email: client.email,
          phone_number: client.phone,
        },
        items: [{
          quantity: 1,
          price: expectedAmountCents,
          description: `Recarga Mais Trilha - R$ ${amount.toFixed(2)}`,
        }],
      });
      const { error: checkoutUpdateError } = await supabase
        .from('infinitepay_checkouts')
        .update({
          checkout_url: link.url,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderNsu);
      if (checkoutUpdateError) throw checkoutUpdateError;

      return NextResponse.json({
        success: true,
        type: 'INFINITEPAY',
        redirectUrl: link.url,
        orderNsu,
        credited: false,
        message: 'O saldo será creditado após confirmação oficial da InfinitePay.',
      });
    } catch (error) {
      await supabase.from('infinitepay_checkouts').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      }).eq('id', orderNsu);
      throw error;
    }
  } catch (error: any) {
    console.error('Erro ao criar recarga InfinitePay:', error);
    return NextResponse.json({ error: error.message || 'Falha ao criar recarga' }, { status: 502 });
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getPublicBaseUrl(request: Request) {
  const configured = String(
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(request.url).origin,
  ).replace(/\/$/, '');
  const url = new URL(configured);
  if (url.protocol !== 'https:') throw new Error('URL pública do site deve usar HTTPS');
  return url.toString().replace(/\/$/, '');
}
