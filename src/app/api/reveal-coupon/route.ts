import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

const CAMPAIGN_ID = 'treasure_hunt_maistrilha2';
const MAX_REDEMPTIONS = 2;
const COUPONS = ['MAISTRILHA-1', 'MAISTRILHA-2'];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const personName = body.personName || 'Anônimo';

    // 1. Pegar informações do usuário (IP e UserAgent)
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'IP_Desconhecido';
    const userAgent = request.headers.get('user-agent') || 'Desconhecido';

    // 2. Verificar quantas vezes o cupom já foi revelado
    const { count, error: countError } = await supabase
      .from('coupon_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', CAMPAIGN_ID);

    if (countError) {
      console.error("Erro ao checar contagem de cupons:", countError);
      return NextResponse.json({ success: false, message: 'Erro no servidor ao validar cupom.' }, { status: 500 });
    }

    if (count !== null && count >= MAX_REDEMPTIONS) {
      // 3. Limite excedido - Não liberar o cupom
      return NextResponse.json({ 
        success: false, 
        exhausted: true, 
        message: 'Os cupons esgotaram!' 
      });
    }

    // 4. Selecionar o cupom baseado em quem chegou primeiro (0 ou 1)
    const assignedCoupon = COUPONS[count || 0];

    // 5. Salvar o IP e o NOME, e Registrar que alguém resgatou agora
    // Isso deve ser inserido antes de enviar o código, como trava
    const { error: insertError } = await supabase
      .from('coupon_redemptions')
      .insert([
        {
          campaign_id: CAMPAIGN_ID,
          ip_address: ipAddress,
          user_agent: userAgent,
          person_name: personName
        }
      ]);

    if (insertError) {
      console.error("Erro ao salvar o resgate:", insertError);
      return NextResponse.json({ success: false, message: 'Erro ao processar sua solicitação.' }, { status: 500 });
    }

    // 6. Sucesso! Enviar o código para a pessoa
    return NextResponse.json({
      success: true,
      coupon_code: assignedCoupon
    });

  } catch (error) {
    console.error("Erro crítico na API de Cupom:", error);
    return NextResponse.json({ success: false, message: 'Erro desconhecido.' }, { status: 500 });
  }
}
