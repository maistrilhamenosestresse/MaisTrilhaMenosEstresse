import 'server-only';

import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { REQUIRED_PAID_TRAILS } from '@/lib/member-access';
import { sendPurchaseEmail } from '@/lib/email';
import { sendWhatsAppText } from '@/lib/whatsapp';

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export async function processConfirmedAsaasPayment(supabase: SupabaseAdmin, payment: any) {
  const reference = String(payment.externalReference || '');
  const paymentId = String(payment.id || '');
  const paidValue = Number(payment.value || 0);
  if (!reference || !paymentId || !Number.isFinite(paidValue) || paidValue <= 0) throw new Error('Pagamento Asaas inválido');

  if (reference.startsWith('RECARGA:')) {
    const clientId = reference.split(':')[1];
    const { data: credited, error } = await supabase.rpc('credit_wallet_from_asaas', {
      p_client_id: clientId,
      p_payment_id: paymentId,
      p_amount: paidValue,
      p_description: 'Recarga de carteira via Asaas',
    });
    if (error) throw error;
    if (credited) {
      await supabase.from('notificacoes').insert({
        tipo: 'recarga', titulo: 'Recarga confirmada',
        mensagem: `Recarga de R$ ${paidValue.toFixed(2)} confirmada.`, lida: false,
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
      mensagem: `Pedido #${orderId.substring(0, 8)} confirmado pela Asaas.`, lida: false,
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

  const reservationIds = await reservationIdsFromReference(supabase, reference);
  return processTrailPayment(supabase, reservationIds, paymentId, paidValue, payment.billingType);
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
  const reservationIds = await reservationIdsFromReference(supabase, reference);
  const { data, error } = await supabase.rpc('cancel_trail_payment', {
    p_reservation_ids: reservationIds, p_payment_id: paymentId,
  });
  if (error) throw error;
  return data ? 'completed' : 'duplicate';
}

async function reservationIdsFromReference(supabase: SupabaseAdmin, reference: string) {
  if (!reference.startsWith('TRILHA:')) return reference.split(',').filter(Boolean);
  const batchId = reference.split(':')[1];
  const { data, error } = await supabase.from('reservas').select('id').eq('checkout_batch_id', batchId);
  if (error) throw error;
  if (!data?.length) throw new Error('Lote de reservas não encontrado');
  return data.map((item) => item.id);
}

async function processTrailPayment(supabase: SupabaseAdmin, reservationIds: string[], paymentId: string, paidValue: number, billingType?: string) {
  if (!reservationIds.length) throw new Error('Reservas ausentes no pagamento');
  const { data: processed, error } = await supabase.rpc('finalize_trail_payment', {
    p_reservation_ids: reservationIds, p_payment_id: paymentId,
    p_paid_amount: paidValue, p_billing_type: billingType || 'ASAAS',
  });
  if (error) throw error;
  if (!processed) return 'duplicate';

  const { data: reservations, error: reservationError } = await supabase.from('reservas')
    .select('*, clients!reservas_client_id_fkey(*), agendas(*)').in('id', reservationIds);
  if (reservationError) throw reservationError;
  const principal = reservations?.find((item: any) => item.clients?.email) || reservations?.[0];
  if (!principal?.clients || !principal?.agendas) return 'completed';

  await supabase.rpc('award_points_from_asaas', {
    p_client_id: principal.clients.id, p_payment_id: paymentId,
    p_points: Math.floor(paidValue), p_description: 'Compra de trilha',
  });
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
      `✅ *NOVA VENDA CONFIRMADA (ASAAS)*\n\n👤 ${principal.clients.full_name}\n🎒 ${principal.agendas.title}\n🎟️ ${reservationIds.length} vaga(s)\n💰 R$ ${paidValue.toFixed(2)}`,
    );
  }
  return 'completed';
}
