import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createOrUpdateCustomer, createPayment, getPixQrCode } from '@/lib/asaas';
import { calculateGrossPrice } from '@/lib/fees';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { processConfirmedAsaasPayment } from '@/lib/server/asaas-payment-processing';

export const dynamic = 'force-dynamic';

type CheckoutBody = {
  reserva_ids?: string[];
  customer_data?: { postalCode?: string; addressNumber?: string };
  payment_method?: 'CREDIT_CARD' | 'PIX' | 'BOLETO';
  credit_card_data?: {
    holderName?: string; number?: string; expiryMonth?: string; expiryYear?: string; ccv?: string;
  };
  installments?: number;
  checkout_source?: 'site' | 'app';
  use_cashback?: boolean;
  use_points?: boolean;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<CheckoutBody>(request, 100_000);
  if (parsed.response) return parsed.response;

  const reservationIds = [...new Set(parsed.data.reserva_ids || [])];
  const paymentMethod = parsed.data.payment_method;
  const installments = Number(parsed.data.installments || 1);
  const isAppCheckout = parsed.data.checkout_source === 'app';
  if (
    !reservationIds.length || reservationIds.length > 20 || reservationIds.some((id) => !isUuid(id)) ||
    !paymentMethod || !['PIX', 'CREDIT_CARD', 'BOLETO'].includes(paymentMethod) ||
    !Number.isInteger(installments) || installments < 1 || installments > 12 ||
    (paymentMethod !== 'CREDIT_CARD' && installments !== 1)
  ) {
    return NextResponse.json({ error: 'Dados do pagamento inválidos' }, { status: 400 });
  }
  if (paymentMethod === 'CREDIT_CARD' && !isValidCardInput(parsed.data.credit_card_data)) {
    return NextResponse.json({ error: 'Dados do cartão incompletos' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  let { data: principal } = await supabase.from('clients').select('*').eq('auth_user_id', auth.user.id).maybeSingle();
  if (!principal && auth.user.email) {
    const result = await supabase.from('clients').select('*').ilike('email', auth.user.email).limit(1).maybeSingle();
    principal = result.data;
  }
  if (!principal) return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 403 });

  const { data: reservations, error: reservationError } = await supabase.from('reservas')
    .select('id, agenda_id, status_pagamento, checkout_owner_id, checkout_batch_id, nsu_transacao, purchase_channel')
    .in('id', reservationIds);
  if (reservationError || !reservations || reservations.length !== reservationIds.length) {
    return NextResponse.json({ error: 'Reservas não encontradas' }, { status: 404 });
  }
  const batchIds = new Set(reservations.map((item) => item.checkout_batch_id).filter(Boolean));
  if (
    batchIds.size !== 1 || reservations.some((item) =>
      item.checkout_owner_id !== principal.id || item.status_pagamento !== 'pendente' || item.nsu_transacao
    )
  ) {
    return NextResponse.json({ error: 'Lote de reservas já processado ou não autorizado' }, { status: 409 });
  }
  if (isAppCheckout && reservations.some((item) => item.purchase_channel !== 'app')) {
    return NextResponse.json({ error: 'O desconto da carteira só pode ser usado no checkout do aplicativo' }, { status: 409 });
  }

  const agendaIds = [...new Set(reservations.map((item) => item.agenda_id))];
  const { data: agendas, error: agendaError } = await supabase.from('agendas')
    .select('id, price, taxa_gratis, accepted_payment_methods')
    .in('id', agendaIds);
  if (agendaError || !agendas || agendas.length !== agendaIds.length) {
    return NextResponse.json({ error: 'Trilhas não encontradas' }, { status: 404 });
  }
  if (agendas.some((agenda: any) =>
    Array.isArray(agenda.accepted_payment_methods) && !agenda.accepted_payment_methods.includes(paymentMethod)
  )) {
    return NextResponse.json({ error: 'Forma de pagamento não aceita para uma das trilhas' }, { status: 400 });
  }

  const netTotal = reservations.reduce((sum, reservation) => {
    const agenda = agendas.find((item) => item.id === reservation.agenda_id);
    if (!agenda) return sum;
    return sum + Number(agenda.price);
  }, 0);
  if (!Number.isFinite(netTotal) || netTotal <= 0) return NextResponse.json({ error: 'Preço inválido' }, { status: 400 });

  const originalValueUpdates = await Promise.all(reservations.map((reservation) => {
    const agenda = agendas.find((item) => item.id === reservation.agenda_id);
    return supabase
      .from('reservas')
      .update({ valor_original: Number(agenda?.price || 0) })
      .eq('id', reservation.id)
      .eq('status_pagamento', 'pendente');
  }));
  if (originalValueUpdates.some((result) => result.error)) {
    return NextResponse.json({ error: 'Não foi possível registrar o valor da venda' }, { status: 500 });
  }

  const postalCode = String(parsed.data.customer_data?.postalCode || '').replace(/\D/g, '');
  const addressNumber = String(parsed.data.customer_data?.addressNumber || '').trim();
  if (paymentMethod === 'CREDIT_CARD' && (postalCode.length !== 8 || !addressNumber)) {
    return NextResponse.json({ error: 'CEP e número do endereço são obrigatórios para cartão' }, { status: 400 });
  }

  const attemptId = randomUUID();
  let claimed = false;
  let paymentCreated = false;
  let benefitId: string | null = null;
  try {
    let netAmountDue = netTotal;
    let benefitSummary: Record<string, unknown> | null = null;
    if (isAppCheckout) {
      const prepared = await supabase.rpc('prepare_app_trail_checkout', {
        p_reservation_ids: reservationIds,
        p_owner_id: principal.id,
        p_gross_amount: netTotal,
        p_use_cashback: parsed.data.use_cashback === true,
        p_use_points: parsed.data.use_points === true,
      });
      if (prepared.error) {
        return NextResponse.json({ error: prepared.error.message }, { status: 409 });
      }
      benefitSummary = prepared.data as Record<string, unknown>;
      benefitId = String(benefitSummary.benefit_id);
      netAmountDue = Number(benefitSummary.amount_due || 0);
    }

    const claim = await supabase.rpc('claim_reservation_checkout', {
      p_reservation_ids: reservationIds,
      p_owner_id: principal.id,
      p_attempt_id: attemptId,
    });
    if (claim.error) {
      if (benefitId) await supabase.rpc('release_app_trail_checkout', { p_benefit_id: benefitId });
      return NextResponse.json({ error: claim.error.message }, { status: 409 });
    }
    claimed = true;

    const trailReference = benefitId
      ? `TRILHA_APP:${benefitId}`
      : `TRILHA:${claim.data}`;

    if (benefitId && netAmountDue <= 0) {
      const internalPaymentId = `INTERNAL:${benefitId}`;
      await processConfirmedAsaasPayment(supabase, {
        id: internalPaymentId,
        externalReference: trailReference,
        value: 0,
        billingType: 'SALDO_E_PONTOS',
      });
      claimed = false;
      return NextResponse.json({
        success: true,
        type: 'INTERNAL',
        paymentId: internalPaymentId,
        status: 'CONFIRMED',
        benefits: benefitSummary,
      });
    }

    const paymentTotal = calculateGrossPrice(netAmountDue, paymentMethod, installments);

    const customerId = await createOrUpdateCustomer({
      name: principal.full_name,
      email: principal.email,
      cpfCnpj: principal.cpf,
      phone: principal.phone,
      postalCode: postalCode || undefined,
      addressNumber: addressNumber || undefined,
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const payload: Record<string, unknown> = {
      customer: customerId,
      billingType: paymentMethod,
      dueDate: dueDate.toISOString().split('T')[0],
      description: `Mais Trilha - Lote ${String(claim.data).slice(0, 8)}`,
      externalReference: trailReference,
      ...(installments > 1 ? { installmentCount: installments, totalValue: paymentTotal } : { value: paymentTotal }),
    };
    if (paymentMethod === 'CREDIT_CARD') {
      const card = parsed.data.credit_card_data!;
      payload.creditCard = {
        holderName: card.holderName!.trim(),
        number: card.number!.replace(/\D/g, ''),
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        ccv: card.ccv,
      };
      payload.creditCardHolderInfo = {
        name: principal.full_name,
        email: principal.email,
        cpfCnpj: String(principal.cpf).replace(/\D/g, ''),
        postalCode,
        addressNumber,
        phone: String(principal.phone).replace(/\D/g, ''),
      };
    }

    const payment = await createPayment(payload);
    paymentCreated = true;
    claimed = false;
    await supabase.from('reservas').update({
      nsu_transacao: payment.id,
      metodo_pagamento: paymentMethod,
    }).in('id', reservationIds).eq('nsu_transacao', `CREATING:${attemptId}`);
    if (benefitId) {
      const attached = await supabase.rpc('attach_app_trail_payment', {
        p_benefit_id: benefitId,
        p_payment_id: payment.id,
      });
      if (attached.error) throw attached.error;
    }
    await supabase.from('asaas_payments').upsert({
      id: payment.id,
      kind: 'trail',
      reference: trailReference,
      client_id: principal.id,
      status: payment.status || 'PENDING',
      amount: paymentTotal,
      updated_at: new Date().toISOString(),
    });

    if (paymentMethod === 'PIX') {
      const pix = await getPixQrCode(payment.id);
      return NextResponse.json({
        success: true, type: 'PIX', paymentId: payment.id,
        encodedImage: pix.encodedImage, payload: pix.payload, expirationDate: pix.expirationDate,
        netAmount: netAmountDue, chargedAmount: paymentTotal,
        benefits: benefitSummary,
      });
    }
    if (paymentMethod === 'BOLETO') {
      return NextResponse.json({
        success: true, type: 'BOLETO', paymentId: payment.id,
        bankSlipUrl: payment.bankSlipUrl, invoiceUrl: payment.invoiceUrl,
        netAmount: netAmountDue, chargedAmount: paymentTotal,
        benefits: benefitSummary,
      });
    }
    return NextResponse.json({
      success: true,
      type: 'CREDIT_CARD',
      paymentId: payment.id,
      status: payment.status,
      netAmount: netAmountDue,
      chargedAmount: paymentTotal,
      benefits: benefitSummary,
    });
  } catch (error: any) {
    if (claimed) {
      await supabase.rpc('release_reservation_checkout_claim', {
        p_reservation_ids: reservationIds,
        p_attempt_id: attemptId,
      });
    }
    if (benefitId && !paymentCreated) {
      await supabase.rpc('release_app_trail_checkout', { p_benefit_id: benefitId });
    }
    console.error('Erro no checkout Asaas:', error);
    return NextResponse.json({ error: error.message || 'Falha ao processar pagamento' }, { status: 502 });
  }
}

function isValidCardInput(card: CheckoutBody['credit_card_data']) {
  if (!card) return false;
  const number = String(card.number || '').replace(/\D/g, '');
  return String(card.holderName || '').trim().length >= 3 && number.length >= 13 && number.length <= 19 &&
    /^\d{2}$/.test(String(card.expiryMonth || '')) && /^\d{4}$/.test(String(card.expiryYear || '')) &&
    /^\d{3,4}$/.test(String(card.ccv || ''));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
