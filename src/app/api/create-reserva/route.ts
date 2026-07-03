import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Suporta tanto o formato antigo { client_id, agenda_id } quanto o novo { reservas: [...] }
    const reservasToInsert = body.reservas || [{
      client_id: body.client_id,
      agenda_id: body.agenda_id,
      status_pagamento: body.status_pagamento || 'pendente',
      valor_pago: body.valor_pago || 0
    }];

    if (reservasToInsert.length === 0) {
      return NextResponse.json({ error: 'Nenhuma reserva enviada' }, { status: 400 });
    }

    const finalReservas = [];

    for (const reserva of reservasToInsert) {
      // 1. Verificar se o cliente já tem uma reserva pendente para esta agenda
      const { data: existingRecords } = await supabaseAdmin
        .from('reservas')
        .select('*')
        .eq('client_id', reserva.client_id)
        .eq('agenda_id', reserva.agenda_id)
        .eq('status_pagamento', 'pendente')
        .limit(1);

      const existing = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

      if (existing) {
        // Aproveita a reserva existente para não duplicar ordem de compra (Carrinho abandonado)
        finalReservas.push(existing);
      } else {
        // Cria uma nova reserva se não houver nenhuma pendente
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('reservas')
          .insert([reserva])
          .select()
          .single();

        if (insertError) {
          console.error("Erro interno ao inserir reserva:", insertError);
          throw new Error(insertError.message);
        }
        finalReservas.push(inserted);
      }
    }

    return NextResponse.json({ success: true, reservas: finalReservas });

  } catch (error: any) {
    console.error("Erro em /api/create-reserva:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
