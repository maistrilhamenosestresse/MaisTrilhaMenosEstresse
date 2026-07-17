import { NextResponse } from 'next/server';
import { createOrUpdateCustomer, createPayment, getPixQrCode } from '@/lib/asaas';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

type CheckoutBody = {
  produtoId?: string;
  clientId?: string;
  method?: 'pix' | 'cartao' | 'cashback';
  creditCard?: Record<string, string>;
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
  const method = input.method || 'pix';
  const deliveryMethod = input.forma_entrega || 'retirada';
  if (!isUuid(input.produtoId || '') || !isUuid(input.clientId || '') ||
      !['pix', 'cartao', 'cashback'].includes(method) ||
      !['retirada', 'correios', 'entrega_trilha'].includes(deliveryMethod)) {
    return NextResponse.json({ error: 'Dados do pedido inválidos' }, { status: 400 });
  }
  if (method === 'cartao' && !isValidCard(input.creditCard)) {
    return NextResponse.json({ error: 'Dados do cartão inválidos' }, { status: 400 });
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

  const postalCode = String(input.postalCode || '').replace(/\D/g, '');
  const addressNumber = String(input.addressNumber || '').trim();
  if (method === 'cartao' && (postalCode.length !== 8 || !addressNumber)) {
    return NextResponse.json({ error: 'CEP e número do endereço são obrigatórios para cartão' }, { status: 400 });
  }

  let orderId: string | null = null;
  let paymentCreated = false;
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

    const customerId = await createOrUpdateCustomer({
      name: client.full_name,
      email: client.email,
      cpfCnpj: client.cpf,
      phone: client.phone,
      postalCode: postalCode || undefined,
      addressNumber: addressNumber || undefined,
    });
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const payload: Record<string, unknown> = {
      customer: customerId,
      billingType: method === 'cartao' ? 'CREDIT_CARD' : 'PIX',
      dueDate: dueDate.toISOString().split('T')[0],
      value: amountDue,
      description: `MaisTrilha Store - Pedido #${orderId.slice(0, 8)}`,
      externalReference: `LOJA:${orderId}`,
    };
    if (method === 'cartao') {
      payload.creditCard = input.creditCard;
      payload.creditCardHolderInfo = {
        name: client.full_name,
        email: client.email,
        cpfCnpj: String(client.cpf).replace(/\D/g, ''),
        postalCode,
        addressNumber,
        phone: String(client.phone).replace(/\D/g, ''),
      };
    }

    const payment = await createPayment(payload);
    paymentCreated = true;
    await supabase.from('pedidos_loja').update({ payment_id: payment.id }).eq('id', orderId);
    await supabase.from('asaas_payments').upsert({
      id: payment.id,
      kind: 'store',
      reference: `LOJA:${orderId}`,
      client_id: client.id,
      status: payment.status || 'PENDING',
      amount: amountDue,
      updated_at: new Date().toISOString(),
    });
    if (method === 'cartao') {
      return NextResponse.json({
        success: true, type: 'CREDIT_CARD_SUCCESS', paymentId: payment.id,
        status: payment.status, orderId,
      });
    }
    const pix = await getPixQrCode(payment.id);
    return NextResponse.json({
      success: true, type: 'PIX', paymentId: payment.id,
      pixEncodedImage: pix.encodedImage, pixPayload: pix.payload, orderId,
    });
  } catch (error: any) {
    if (orderId && !paymentCreated) {
      await supabase.rpc('cancel_store_order', {
        p_order_id: orderId,
        p_payment_id: `ORDER:${orderId}`,
        p_status: 'cancelado',
      });
    }
    console.error('Erro no checkout da loja:', error);
    return NextResponse.json({ error: error.message || 'Falha no checkout' }, { status: 502 });
  }
}

function isValidCard(card?: Record<string, string>) {
  const number = String(card?.number || '').replace(/\D/g, '');
  return number.length >= 13 && number.length <= 19 && String(card?.holderName || '').trim().length >= 3 &&
    /^\d{2}$/.test(String(card?.expiryMonth || '')) && /^\d{4}$/.test(String(card?.expiryYear || '')) &&
    /^\d{3,4}$/.test(String(card?.ccv || ''));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
