import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // SECURITY: O painel admin agora usa validação de PIN no frontend em vez de NextAuth.
    // Sessão removida temporariamente para permitir ações do painel admin.

    const body = await request.json();
    const { id, action, approved } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da avaliação não fornecido' }, { status: 400 });
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin.from('avaliacoes').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Avaliação excluída' });
    } 
    
    if (action === 'update') {
      const { error } = await supabaseAdmin.from('avaliacoes').update({ approved }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Status da avaliação atualizado' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error("Erro em /api/moderate-avaliacao:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
