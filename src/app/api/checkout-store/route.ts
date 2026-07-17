import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createInfinitePayLink } from '@/lib/server/infinitepay';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

type CheckoutBody = {
  produtoId?: string;
  clientId?: string;
  method?: 'infinitepay' | 'pix' | 'cartao' | 'cashback';
  postalCode?: string;
  addressNumber?: string;
  forma_entrega?: 'retirada' | 'correios' | 'entrega_trilha';
  delivery_info?: string;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<CheckoutBody>(request, 100_000);
  if (parsed.response) return parsed.response;

  const input = parsed.data;
  const requestedMethod = input.method || 'infinitepay';
  const method = requestedMethod === 'cashback' ? 'cashback' : 'infinitepay';
  const deliveryMethod = input.forma_entrega || 'retirada';
  if (!isUuid(input.produtoId || '') || !isUuid(input.clientId || '') ||
      !['infinitepay', 'pix', 'cartao', 'cashback'].includes(requestedMethod) ||
      !['retirada', 'correios', 'entrega_trilha'].includes(deliveryMethod)) {
    return NextResponse.json({ error: 'Dados do pedido inválidos' }, { status: 400 });
  }
  const deliveryInfo = String(input.delivery_info || '').trim().slice(0, 1000);
  if (deliveryMethod !== 'retirada' && deliveryInfo.length < 5) {
    return NextResponse.json({ error: 'Informe os dados de entrega' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const [{ data: client }, { data: product }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', input.clientId).maybeSingle(),
    supabase.from('produtos').select('id, active').eq('id', input.produtoId).maybeSingle(),
  ]);
  if (!client || !product?.active) return NextResponse.json({ error: 'Cliente ou produto não encontrado' }, { status: 404 });
  const isOwner = client.auth_user_id === auth.user.id || client.email?.toLowerCase() === auth.user.email?.toLowerCase();
  if (!isOwner) return NextResponse.json({ error: 'Compra em nome de outro cliente não permitida' }, { status: 403 });

  let orderId: string | null = null;
  let paymentCreated = false;
  let infinitePayOrderNsu: string | null = null;
  try {
    const { data: order, error: orderError } = await supabase.rpc('create_store_order', {
      p_client_id: client.id,
      p_product_id: input.produtoId,
      p_delivery_method: deliveryMethod,
      p_delivery_info: deliveryInfo,
    });
    if (orderError) throw orderError;
    orderId = String(order.order_id);
    const amountDue = Number(order.amount_due);
    if (order.paid || amountDue <= 0) {
      return NextResponse.json({ success: true, type: 'CASHBACK_FULL', orderId });
    }
    if (method === 'cashback') throw new Error('O saldo não cobre o valor total do produto');

    const orderNsu = randomUUID();
    infinitePayOrderNsu = orderNsu;
    const expectedAmountCents = Math.round(amountDue * 100);
    const reference = `LOJA:${orderId}`;
    const { error: checkoutInsertError } = await supabase.from('infinitepay_checkouts').insert({
      id: orderNsu,
      order_nsu: orderNsu,
      kind: 'store',
      reference,
      client_id: client.id,
      expected_amount_cents: expectedAmountCents,
      status: 'creating',
    });
    if (checkoutInsertError) throw checkoutInsertError;

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
        description: `MaisTrilha Store - Pedido #${orderId.slice(0, 8)}`,
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

    const pendingPaymentId = `IP:${orderNsu}`;
    const orderUpdate = await supabase
      .from('pedidos_loja')
      .update({ payment_id: pendingPaymentId, metodo_pagamento: 'INFINITEPAY' })
      .eq('id', orderId);
    if (orderUpdate.error) throw orderUpdate.error;
    paymentCreated = true;
    return NextResponse.json({
      success: true,
      type: 'INFINITEPAY',
      redirectUrl: link.url,
      orderNsu,
      orderId,
    });
  } catch (error: any) {
    if (orderId && !paymentCreated) {
      await supabase.rpc('cancel_store_order', {
        p_order_id: orderId,
        p_payment_id: `ORDER:${orderId}`,
        p_status: 'cancelado',
      });
    }
    if (infinitePayOrderNsu && !paymentCreated) {
      await supabase.from('infinitepay_checkouts').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      }).eq('id', infinitePayOrderNsu);
    }
    console.error('Erro no checkout da loja:', error);
    return NextResponse.json({ error: error.message || 'Falha no checkout' }, { status: 502 });
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
