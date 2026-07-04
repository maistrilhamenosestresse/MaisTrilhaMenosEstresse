import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPurchaseEmail } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // SECURITY: Validação do Webhook Secret para evitar ataques de spoofing
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const authHeader = request.headers.get('authorization');
    
    // Se a variável de ambiente existir, exige validação rigorosa
    if (process.env.INFINITEPAY_WEBHOOK_SECRET) {
      if (token !== process.env.INFINITEPAY_WEBHOOK_SECRET && authHeader !== `Bearer ${process.env.INFINITEPAY_WEBHOOK_SECRET}`) {
        console.error("Tentativa de invasão bloqueada no Webhook: Assinatura inválida.");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const data = await request.json();

    // Log bruto do webhook para debugar o payload do Pix
    try {
      await supabase.from('notificacoes').insert([{ 
        reserva_id: null,
        mensagem: 'WEBHOOK RAW: ' + JSON.stringify(data).substring(0, 500),
        lida: false
      }]);
    } catch (e) {
      console.error("Erro ao salvar log bruto", e);
    }

    const payloadInfo = data.payload || data.data || data;

    const { 
      invoice_slug, 
      amount, 
      paid_amount, 
      capture_method, 
      transaction_nsu, 
      order_nsu 
    } = payloadInfo;

    const isApprovedEvent = 
      (data.event && (data.event.includes('approve') || data.event.includes('paid'))) || 
      payloadInfo.status === 'approved' || 
      payloadInfo.status === 'paid';

    // SECURITY: Validação estrita de pagamento integral (Impede fraude de pagamento parcial)
    // Exige que o valor pago seja igual ou maior que o valor cobrado na fatura.
    const isFullyPaid = isApprovedEvent && paid_amount && amount && (Number(paid_amount) >= Number(amount));

    if (!isFullyPaid) {
      console.warn('Ignorando evento não finalizado ou com pagamento parcial/inválido:', data.event, payloadInfo.status, 'Pago:', paid_amount, 'Esperado:', amount);
      return NextResponse.json({ success: true, message: 'Evento ignorado (pendente ou parcial)' }, { status: 200 });
    }

    // A InfinitePay envia o array de reserva_ids via metadata
    const metadataReservas = data.metadata?.reservas || payloadInfo.metadata?.reservas;
    
    const fallback_nsu = data.metadata?.order_nsu || data.metadata?.reserva_id || payloadInfo.metadata?.order_nsu || payloadInfo.metadata?.reserva_id;
    const final_order_nsu = order_nsu || fallback_nsu;

    let reserva_ids = [];
    if (Array.isArray(metadataReservas) && metadataReservas.length > 0) {
      reserva_ids = metadataReservas;
    } else if (final_order_nsu && !final_order_nsu.startsWith('PEDIDO-')) {
      reserva_ids = final_order_nsu.includes(',') ? final_order_nsu.split(',') : [final_order_nsu];
    } else if (final_order_nsu && final_order_nsu.startsWith('PEDIDO-')) {
      // Recupera o mapeamento salvo no checkout
      const { data: notif, error: notifErr } = await supabase.from('notificacoes')
        .select('mensagem')
        .ilike('mensagem', `CHECKOUT_MAPPING: ${final_order_nsu} -> %`)
        .limit(1)
        .maybeSingle();
        
      if (notif && notif.mensagem) {
        const idsString = notif.mensagem.split(' -> ')[1];
        if (idsString) {
          reserva_ids = idsString.split(',');
        }
      }
    }

    if (reserva_ids.length === 0) {
      console.error('Webhook Inválido. Pedido ou reservas não encontrados no Payload.');
      return NextResponse.json({ success: false, message: 'Pedido/Reservas não encontrados' }, { status: 400 });
    }

    // 1. Atualizar a Tabela de Reservas no Supabase marcando todas como Pagas
    const { error } = await supabase
      .from('reservas')
      .update({ 
        status_pagamento: 'pago',
        valor_pago: (paid_amount / 100) / reserva_ids.length
      })
      .in('id', reserva_ids);

    if (error) {
      console.error("Erro ao atualizar reservas:", error);
    } else {
      // 2. Buscar Dados para Notificação e Email (tentando achar o comprador principal)
      try {
        const { data: allRes } = await supabase
          .from('reservas')
          .select('*, clients(*), agendas(*)')
          .in('id', reserva_ids);

        let resData = null;
        if (allRes && allRes.length > 0) {
          resData = allRes.find(r => r.clients && r.clients.email) || allRes[0];
        }

        if (resData && resData.clients && resData.agendas) {
          
          let mensagemNotificacao = `COMPRA APROVADA: ${resData.clients.full_name} comprou ${reserva_ids.length} vaga(s) para ${resData.agendas.title} no valor total de R$ ${(paid_amount / 100).toFixed(2)}`;

          // Inserir Notificação Bonita
          await supabase.from('notificacoes').insert([{
            reserva_id: reserva_ids[0],
            mensagem: mensagemNotificacao,
            lida: false
          }]);

          // Disparar Email
          try {
            await sendPurchaseEmail(resData.clients, resData.agendas, allRes || []);
          } catch (emailErr) {
             console.error("Erro ao enviar email de compra aprovada", emailErr);
          }
        }
      } catch (notifErr) {
        console.error("Erro ao gerar notificação do webhook", notifErr);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error("Erro geral no webhook da InfinitePay:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
