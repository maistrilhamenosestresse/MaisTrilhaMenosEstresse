import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { requireAdminUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export async function POST(request: Request) {
  try {
    const originError = assertSameOrigin(request);
    if (originError) return originError;
    const auth = await requireAdminUser();
    if (auth.response) return auth.response;

    // SECURITY: O painel admin agora usa validação de PIN no frontend em vez de NextAuth.
    // Sessão removida temporariamente para permitir ações do painel admin.

    const parsed = await readJsonBody<any>(request, 10_000);
    if (parsed.response) return parsed.response;
    const body = parsed.data;
    const { id, action, approved } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da avaliação não fornecido' }, { status: 400 });
    }

    if (action === 'delete') {
      const { error } = await createSupabaseAdmin().from('avaliacoes').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Avaliação excluída' });
    } 
    
    if (action === 'update') {
      const { error } = await createSupabaseAdmin().from('avaliacoes').update({ approved: approved === true }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Status da avaliação atualizado' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error("Erro em /api/moderate-avaliacao:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
