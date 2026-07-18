import 'server-only';

import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { REQUIRED_PAID_TRAILS } from '@/lib/member-access';
import { sendPurchaseEmail } from '@/lib/email';
import { sendWhatsAppText } from '@/lib/whatsapp';

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;
type PaymentProvider = 'ASAAS' | 'INFINITEPAY' | 'INTERNAL';

export async function processConfirmedAsaasPayment(supabase: SupabaseAdmin, payment: any) {
  const reference = String(payment.externalReference || '');
  const paymentId = String(payment.id || '');
  const paidValue = Number(payment.value || 0);
  const isInternalAppCheckout = reference.startsWith('TRILHA_APP:') && paymentId.startsWith('INTERNAL:');
  if (
    !reference ||
    !paymentId ||
    !Number.isFinite(paidValue) ||
    paidValue < 0 ||
    (paidValue === 0 && !isInternalAppCheckout)
  ) {
    throw new Error('Pagamento Asaas inválido');
  }

  return processConfirmedProviderPayment(supabase, {
    reference,
    paymentId,
    paidValue,
    customerChargedValue: paidValue,
    billingType: payment.billingType || 'ASAAS',
    provider: isInternalAppCheckout ? 'INTERNAL' : 'ASAAS',
  });
}

export async function processConfirmedProviderPayment(
  supabase: SupabaseAdmin,
  payment: {
    reference: string;
    paymentId: string;
    paidValue: number;
    customerChargedValue?: number;
    billingType: string;
    provider: PaymentProvider;
  },
) {
  const reference = String(payment.reference || '');
  const paymentId = String(payment.paymentId || '');
  const paidValue = Number(payment.paidValue || 0);
  const customerChargedValue = Number(payment.customerChargedValue ?? paidValue);
  const isInternalAppCheckout = payment.provider === 'INTERNAL' &&
    reference.startsWith('TRILHA_APP:') &&
    paymentId.startsWith('INTERNAL:');
  if (
    !reference ||
    !paymentId ||
    !Number.isFinite(paidValue) ||
    !Number.isFinite(customerChargedValue) ||
    paidValue < 0 ||
    customerChargedValue < paidValue ||
    (paidValue === 0 && !isInternalAppCheckout)
  ) {
    throw new Error('Pagamento confirmado inválido');
  }

  if (reference.startsWith('RECARGA:')) {
    const [, clientId, netAmountCents] = reference.split(':');
    const configuredAmount = Number(netAmountCents) / 100;
    const creditAmount = Number.isFinite(configuredAmount) && configuredAmount > 0
      ? configuredAmount
      : paidValue;
    if (creditAmount > paidValue + 0.01) {
      throw new Error('Valor recebido abaixo da recarga contratada');
    }
    const creditRpc = payment.provider === 'INFINITEPAY'
      ? await supabase.rpc('credit_wallet_from_provider', {
          p_client_id: clientId,
          p_payment_id: paymentId,
          p_amount: creditAmount,
          p_description: 'Recarga de carteira via InfinitePay',
          p_provider: 'INFINITEPAY',
        })
      : await supabase.rpc('credit_wallet_from_asaas', {
          p_client_id: clientId,
          p_payment_id: paymentId,
          p_amount: creditAmount,
          p_description: 'Recarga de carteira via Asaas',
        });
    const { data: credited, error } = creditRpc;
    if (error) throw error;
    if (credited) {
      await supabase.from('notificacoes').insert({
        tipo: 'recarga', titulo: 'Recarga confirmada',
        mensagem: `Recarga de R$ ${creditAmount.toFixed(2)} confirmada.`, lida: false,
      });
    }
    return credited ? 'completed' : 'duplicate';
  }

  if (reference.startsWith('LOJA:')) {
    const orderId = reference.split(':')[1];
    const { data: processed, error } = await supabase.rpc('finalize_store_order_from_asaas', {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_paid_amount: paidValue,
    });
    if (error) throw error;
    if (!processed) return 'duplicate';
    const { data: order } = await supabase.from('pedidos_loja')
      .select('*, clients(full_name, phone), produtos(name)').eq('id', orderId).single();
    await supabase.from('notificacoes').insert({
      tipo: 'venda_loja', titulo: 'Nova venda na loja',
      mensagem: `Pedido #${orderId.substring(0, 8)} confirmado pela ${providerLabel(payment.provider)}.`, lida: false,
    });
    if (order && process.env.WHATSAPP_ADMIN_NUMBER) {
      const client = order.clients as any;
      const product = order.produtos as any;
      await sendWhatsAppText(
        process.env.WHATSAPP_ADMIN_NUMBER,
        `✅ *NOVA VENDA NA LOJA!*\n\n👤 ${client?.full_name || 'Cliente'}\n🎒 ${product?.name || 'Produto'}\n📱 ${client?.phone || 'Não informado'}`,
      );
    }
    return 'completed';
  }

  if (reference.startsWith('TRILHA_APP:')) {
    const benefitId = reference.split(':')[1];
    const { data: processed, error } = await supabase.rpc('finalize_app_trail_checkout', {
      p_benefit_id: benefitId,
      p_payment_id: paymentId,
      p_paid_amount: paidValue,
      p_billing_type: payment.billingType,
    });
    if (error) throw error;
    if (!processed) return 'duplicate';
    const { data: benefit, error: benefitError } = await supabase
      .from('trail_checkout_benefits')
      .select('reservation_ids, owner_id, amount_due')
      .eq('id', benefitId)
      .single();
    if (benefitError || !benefit?.reservation_ids?.length) {
      throw benefitError || new Error('Checkout do aplicativo não encontrado');
    }
    return completeTrailPayment(
      supabase,
      benefit.reservation_ids,
      paymentId,
      Number(benefit.amount_due || 0),
      true,
      benefit.owner_id,
      customerChargedValue,
      payment.provider,
    );
  }

  const reservationIds = await reservationIdsFromReference(supabase, reference);
  return processTrailPayment(
    supabase,
    reservationIds,
    paymentId,
    paidValue,
    payment.billingType,
    customerChargedValue,
    payment.provider,
  );
}

export async function processCanceledAsaasPayment(supabase: SupabaseAdmin, payment: any, event: string) {
  const reference = String(payment.externalReference || '');
  const paymentId = String(payment.id || '');
  if (reference.startsWith('LOJA:')) {
    const status = event === 'PAYMENT_OVERDUE'
      ? 'expirado'
      : ['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'].includes(event) ? 'estornado' : 'cancelado';
    const { data, error } = await supabase.rpc('cancel_store_order', {
      p_order_id: reference.split(':')[1], p_payment_id: paymentId, p_status: status,
    });
    if (error) throw error;
    return data ? 'completed' : 'duplicate';
  }
  if (reference.startsWith('RECARGA:')) {
    const { data, error } = await supabase.rpc('reverse_wallet_credit_from_asaas', {
      p_client_id: reference.split(':')[1], p_payment_id: paymentId,
    });
    if (error) throw error;
    return data ? 'completed' : 'duplicate';
  }
  if (reference.startsWith('TRILHA_APP:')) {
    const status = event === 'PAYMENT_OVERDUE'
      ? 'expirado'
      : ['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'].includes(event) ? 'estornado' : 'cancelado';
    const { data, error } = await supabase.rpc('cancel_app_trail_checkout', {
      p_benefit_id: reference.split(':')[1],
      p_payment_id: paymentId,
      p_status: status,
    });
    if (error) throw error;
    return data ? 'completed' : 'duplicate';
  }
  const reservationIds = await reservationIdsFromReference(supabase, reference);
  const { data, error } = await supabase.rpc('cancel_trail_payment', {
    p_reservation_ids: reservationIds, p_payment_id: paymentId,
  });
  if (error) throw error;
  return data ? 'completed' : 'duplicate';
}

async function reservationIdsFromReference(supabase: SupabaseAdmin, reference: string) {
  if (reference.startsWith('TRILHA_APP:')) {
    const { data, error } = await supabase
      .from('trail_checkout_benefits')
      .select('reservation_ids')
      .eq('id', reference.split(':')[1])
      .single();
    if (error || !data?.reservation_ids?.length) throw error || new Error('Checkout do aplicativo não encontrado');
    return data.reservation_ids;
  }
  if (!reference.startsWith('TRILHA:')) return reference.split(',').filter(Boolean);
  const batchId = reference.split(':')[1];
  const { data, error } = await supabase.from('reservas').select('id').eq('checkout_batch_id', batchId);
  if (error) throw error;
  if (!data?.length) throw new Error('Lote de reservas não encontrado');
  return data.map((item) => item.id);
}

async function processTrailPayment(
  supabase: SupabaseAdmin,
  reservationIds: string[],
  paymentId: string,
  paidValue: number,
  billingType: string,
  customerChargedValue: number,
  provider: PaymentProvider,
) {
  if (!reservationIds.length) throw new Error('Reservas ausentes no pagamento');
  const { data: reservationValues, error: valueError } = await supabase
    .from('reservas')
    .select('valor_original')
    .in('id', reservationIds);
  if (valueError) throw valueError;
  const configuredNetValue = (reservationValues || []).reduce(
    (sum, reservation) => sum + Number(reservation.valor_original || 0),
    0,
  );
  const saleValue = configuredNetValue > 0 ? configuredNetValue : paidValue;
  if (paidValue + 0.01 < saleValue) {
    throw new Error('Valor recebido abaixo do líquido configurado');
  }
  const { data: processed, error } = await supabase.rpc('finalize_trail_payment', {
    p_reservation_ids: reservationIds, p_payment_id: paymentId,
    p_paid_amount: saleValue, p_billing_type: billingType,
  });
  if (error) throw error;
  if (!processed) return 'duplicate';
  return completeTrailPayment(
    supabase,
    reservationIds,
    paymentId,
    saleValue,
    false,
    undefined,
    customerChargedValue,
    provider,
  );
}

async function completeTrailPayment(
  supabase: SupabaseAdmin,
  reservationIds: string[],
  paymentId: string,
  paidValue: number,
  rewardEligible: boolean,
  ownerId?: string,
  customerChargedValue = paidValue,
  provider: PaymentProvider = 'ASAAS',
) {
  const { data: reservations, error: reservationError } = await supabase.from('reservas')
    .select('*, clients!reservas_client_id_fkey(*), agendas(*)').in('id', reservationIds);
  if (reservationError) throw reservationError;
  const principal = reservations?.find((item: any) => ownerId && item.client_id === ownerId)
    || reservations?.find((item: any) => item.clients?.email)
    || reservations?.[0];
  if (!principal?.clients || !principal?.agendas) return 'completed';

  if (rewardEligible && Math.floor(paidValue) > 0) {
    await supabase.rpc('award_points_from_asaas', {
      p_client_id: principal.clients.id,
      p_payment_id: paymentId,
      p_points: Math.floor(paidValue),
      p_description: 'Compra de trilha pelo app',
    });
  }
  const { count } = await supabase.from('reservas').select('id', { count: 'exact', head: true })
    .eq('client_id', principal.clients.id).eq('status_pagamento', 'pago');
  if ((count || 0) >= REQUIRED_PAID_TRAILS && !principal.clients.membro_vip) {
    await supabase.from('clients').update({ membro_vip: true }).eq('id', principal.clients.id);
  }
  await supabase.from('notificacoes').insert({
    tipo: 'venda_trilha', titulo: 'Pagamento confirmado', reserva_id: reservationIds[0],
    mensagem: `${principal.clients.full_name} confirmou ${reservationIds.length} vaga(s) para ${principal.agendas.title}.`, lida: false,
  });
  await sendPurchaseEmail(principal.clients, principal.agendas, reservations || []);
  if (process.env.WHATSAPP_ADMIN_NUMBER) {
    await sendWhatsAppText(
      process.env.WHATSAPP_ADMIN_NUMBER,
      `✅ *NOVA VENDA CONFIRMADA (${providerLabel(provider).toUpperCase()})*\n\n👤 ${principal.clients.full_name}\n🎒 ${principal.agendas.title}\n🎟️ ${reservationIds.length} vaga(s)\n💰 Venda líquida: R$ ${paidValue.toFixed(2)}\n💳 Cobrado do cliente: R$ ${customerChargedValue.toFixed(2)}`,
    );
  }
  return 'completed';
}

function providerLabel(provider: PaymentProvider) {
  if (provider === 'INTERNAL') return 'saldo e pontos';
  if (provider === 'INFINITEPAY') return 'InfinitePay';
  return 'Asaas';
}
