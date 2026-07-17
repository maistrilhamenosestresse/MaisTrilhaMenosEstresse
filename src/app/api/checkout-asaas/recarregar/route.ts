import { NextResponse } from 'next/server';
import { createOrUpdateCustomer, createPayment, getPixQrCode } from '@/lib/asaas';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

type RechargeBody = {
  amount?: number | string;
  clientId?: string;
  method?: 'pix' | 'cartao';
  creditCard?: Record<string, string>;
  postalCode?: string;
  addressNumber?: string;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<RechargeBody>(request, 50_000);
  if (parsed.response) return parsed.response;

  const amount = Number(String(parsed.data.amount || '').replace(',', '.'));
  const method = parsed.data.method || 'pix';
  const clientId = String(parsed.data.clientId || '');
  if (!Number.isFinite(amount) || amount < 5 || amount > 5000 || !isUuid(clientId) || !['pix', 'cartao'].includes(method)) {
    return NextResponse.json({ error: 'Valor, cliente ou forma de pagamento inválida' }, { status: 400 });
  }
  if (method === 'cartao' && !isValidCard(parsed.data.creditCard)) {
    return NextResponse.json({ error: 'Dados do cartão inválidos' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  const isOwner = client.auth_user_id === auth.user.id || client.email?.toLowerCase() === auth.user.email?.toLowerCase();
  if (!isOwner) return NextResponse.json({ error: 'Cliente não pertence à sessão' }, { status: 403 });

  const postalCode = String(parsed.data.postalCode || '').replace(/\D/g, '');
  const addressNumber = String(parsed.data.addressNumber || '').trim();
  if (method === 'cartao' && (postalCode.length !== 8 || !addressNumber)) {
    return NextResponse.json({ error: 'CEP e número do endereço são obrigatórios para cartão' }, { status: 400 });
  }

  try {
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
      value: amount,
      description: `Mais Trilha - Recarga de carteira (R$ ${amount.toFixed(2)})`,
      externalReference: `RECARGA:${clientId}`,
    };
    if (method === 'cartao') {
      payload.creditCard = parsed.data.creditCard;
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
    await supabase.from('asaas_payments').upsert({
      id: payment.id,
      kind: 'recharge',
      reference: `RECARGA:${clientId}`,
      client_id: clientId,
      status: payment.status || 'PENDING',
      amount,
      updated_at: new Date().toISOString(),
    });
    if (method === 'cartao') {
      return NextResponse.json({
        success: true,
        credited: false,
        paymentId: payment.id,
        status: payment.status,
        message: 'O saldo será creditado somente após a confirmação da Asaas.',
      });
    }
    const pix = await getPixQrCode(payment.id);
    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      encodedImage: pix.encodedImage,
      payload: pix.payload,
      expirationDate: pix.expirationDate,
    });
  } catch (error: any) {
    console.error('Erro ao criar recarga Asaas:', error);
    return NextResponse.json({ error: error.message || 'Falha ao criar recarga' }, { status: 502 });
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
