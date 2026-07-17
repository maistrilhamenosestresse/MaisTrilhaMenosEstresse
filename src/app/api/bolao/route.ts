import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const originError = assertSameOrigin(request);
    if (originError) return originError;
    const lockTime = new Date('2026-07-05T16:55:00-03:00').getTime();
    if (new Date().getTime() >= lockTime) {
      return NextResponse.json({ error: 'O Bolão já está encerrado! Boa sorte aos participantes.' }, { status: 400 });
    }

    const parsed = await readJsonBody<any>(request, 20_000);
    if (parsed.response) return parsed.response;
    const { nome, whatsapp, placar_brasil, placar_rival, rival_nome } = parsed.data;
    const supabase = createSupabaseAdmin();

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
    const { data, error } = await createSupabaseAdmin()
      .from('bolao_apostas')
      .select('nome, placar_brasil, placar_rival, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    return NextResponse.json({ apostas: data || [] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
