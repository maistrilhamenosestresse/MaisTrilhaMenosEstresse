import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const lockTime = new Date('2026-07-05T16:55:00-03:00').getTime();
    if (new Date().getTime() >= lockTime) {
      return NextResponse.json({ error: 'O Bolão já está encerrado! Boa sorte aos participantes.' }, { status: 400 });
    }

    const { nome, whatsapp, placar_brasil, placar_rival, rival_nome } = await request.json();

    if (!nome || !whatsapp || placar_brasil === undefined || placar_rival === undefined) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 0. Checa se a pessoa já apostou pelo whatsapp
    const { data: existingUser } = await supabase
      .from('bolao_apostas')
      .select('placar_brasil, placar_rival')
      .eq('whatsapp', whatsapp)
      .limit(1)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ 
        error: `Você já registrou um palpite (${existingUser.placar_brasil} x ${existingUser.placar_rival})! É permitida apenas uma aposta por WhatsApp.`
      }, { status: 400 });
    }

    // 1. Checa se o placar já existe
    const { data: existingBet, error: checkError } = await supabase
      .from('bolao_apostas')
      .select('nome')
      .eq('placar_brasil', placar_brasil)
      .eq('placar_rival', placar_rival)
      .limit(1)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Erro ao checar placar:", checkError);
      return NextResponse.json({ error: 'Erro no banco de dados' }, { status: 500 });
    }

    if (existingBet) {
      return NextResponse.json({ 
        error: `Placar repetido! O(a) ${existingBet.nome} já apostou ${placar_brasil} x ${placar_rival}. Tente outro!`,
        duplicate: true
      }, { status: 400 });
    }

    // 2. Insere a nova aposta
    const { error: insertError } = await supabase
      .from('bolao_apostas')
      .insert([{
        nome,
        whatsapp,
        placar_brasil,
        placar_rival,
        rival_nome: rival_nome || 'Adversário'
      }]);

    if (insertError) {
      // Falha por unique constraint
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Outra pessoa acabou de apostar este placar. Tente outro rápido!' }, { status: 400 });
      }
      console.error("Erro ao inserir aposta:", insertError);
      return NextResponse.json({ error: 'Falha ao salvar aposta' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error("Erro na API do bolão:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { data, error } = await supabase
      .from('bolao_apostas')
      .select('nome, placar_brasil, placar_rival, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    return NextResponse.json({ apostas: data || [] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
