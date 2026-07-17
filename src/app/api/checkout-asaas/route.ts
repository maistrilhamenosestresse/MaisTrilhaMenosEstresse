import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createOrUpdateCustomer, createPayment } from '@/lib/asaas';
import { calculateGrossPrice } from '@/lib/fees';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createInfinitePayLink } from '@/lib/server/infinitepay';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { processConfirmedAsaasPayment } from '@/lib/server/asaas-payment-processing';

export const dynamic = 'force-dynamic';

type CheckoutBody = {
  reserva_ids?: string[];
  customer_data?: { postalCode?: string; addressNumber?: string };
  payment_method?: 'INFINITEPAY' | 'CREDIT_CARD' | 'PIX' | 'BOLETO';
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
  const requestedMethod = parsed.data.payment_method;
  const paymentMethod = requestedMethod === 'BOLETO' ? 'BOLETO' : 'INFINITEPAY';
  const installments = Number(parsed.data.installments || 1);
  const isAppCheckout = parsed.data.checkout_source === 'app';
  if (
    !reservationIds.length || reservationIds.length > 20 || reservationIds.some((id) => !isUuid(id)) ||
    !requestedMethod || !['INFINITEPAY', 'PIX', 'CREDIT_CARD', 'BOLETO'].includes(requestedMethod) ||
    !Number.isInteger(installments) || installments < 1 || installments > 12 ||
    (paymentMethod === 'BOLETO' && installments !== 1)
  ) {
    return NextResponse.json({ error: 'Dados do pagamento inválidos' }, { status: 400 });
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
  if (agendas.some((agenda: any) => {
    if (!Array.isArray(agenda.accepted_payment_methods)) return false;
    return paymentMethod === 'BOLETO'
      ? !agenda.accepted_payment_methods.includes('BOLETO')
      : !agenda.accepted_payment_methods.some((method: string) => ['PIX', 'CREDIT_CARD'].includes(method));
  })) {
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
  const attemptId = randomUUID();
  let claimed = false;
  let paymentCreated = false;
  let benefitId: string | null = null;
  let infinitePayOrderNsu: string | null = null;
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

    if (paymentMethod === 'INFINITEPAY') {
      const orderNsu = randomUUID();
      infinitePayOrderNsu = orderNsu;
      const expectedAmountCents = Math.round(netAmountDue * 100);
      const { error: checkoutInsertError } = await supabase.from('infinitepay_checkouts').insert({
        id: orderNsu,
        order_nsu: orderNsu,
        kind: 'trail',
        reference: trailReference,
        client_id: principal.id,
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
          name: principal.full_name,
          email: principal.email,
          phone_number: principal.phone,
        },
        items: [{
          quantity: 1,
          price: expectedAmountCents,
          description: `Mais Trilha - Lote ${String(claim.data).slice(0, 8)}`,
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
      const reservationUpdate = await supabase.from('reservas').update({
        nsu_transacao: pendingPaymentId,
        metodo_pagamento: 'INFINITEPAY',
      }).in('id', reservationIds).eq('nsu_transacao', `CREATING:${attemptId}`);
      if (reservationUpdate.error) throw reservationUpdate.error;
      if (benefitId) {
        const attached = await supabase.rpc('attach_app_trail_payment', {
          p_benefit_id: benefitId,
          p_payment_id: pendingPaymentId,
        });
        if (attached.error) throw attached.error;
      }
      paymentCreated = true;
      claimed = false;
      return NextResponse.json({
        success: true,
        type: 'INFINITEPAY',
        provider: 'INFINITEPAY',
        redirectUrl: link.url,
        orderNsu,
        netAmount: netAmountDue,
        benefits: benefitSummary,
      });
    }

    const paymentTotal = calculateGrossPrice(netAmountDue, 'BOLETO', 1);

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
      billingType: 'BOLETO',
      dueDate: dueDate.toISOString().split('T')[0],
      description: `Mais Trilha - Lote ${String(claim.data).slice(0, 8)}`,
      externalReference: trailReference,
      ...(installments > 1 ? { installmentCount: installments, totalValue: paymentTotal } : { value: paymentTotal }),
    };
    const payment = await createPayment(payload);
    paymentCreated = true;
    claimed = false;
    await supabase.from('reservas').update({
      nsu_transacao: payment.id,
      metodo_pagamento: 'BOLETO',
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

    return NextResponse.json({
      success: true, type: 'BOLETO', paymentId: payment.id,
      bankSlipUrl: payment.bankSlipUrl, invoiceUrl: payment.invoiceUrl,
      netAmount: netAmountDue, chargedAmount: paymentTotal,
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
    if (infinitePayOrderNsu && !paymentCreated) {
      await supabase.from('infinitepay_checkouts').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      }).eq('id', infinitePayOrderNsu);
    }
    console.error('Erro no checkout híbrido:', error);
    return NextResponse.json({ error: error.message || 'Falha ao processar pagamento' }, { status: 502 });
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
