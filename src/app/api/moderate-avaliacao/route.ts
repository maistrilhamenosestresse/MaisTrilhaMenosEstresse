import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { requireAdminUser } from '@/lib/server/auth';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const originError = assertSameOrigin(request);
    if (originError) return originError;
    const auth = await requireAdminUser();
    if (auth.response) return auth.response;

    const parsed = await readJsonBody<{ id?: string; action?: 'delete' | 'update'; approved?: boolean }>(request, 10_000);
    if (parsed.response) return parsed.response;
    const body = parsed.data;
    const { id, action, approved } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da avaliação não fornecido' }, { status: 400 });
    }

    const supabase = await createClient();

    if (action === 'delete') {
      const { error } = await supabase.from('avaliacoes').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Avaliação excluída' });
    } 
    
    if (action === 'update') {
      const { error } = await supabase.from('avaliacoes').update({ approved: approved === true }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Status da avaliação atualizado' });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error("Erro em /api/moderate-avaliacao:", error);
    return NextResponse.json({ error: 'Não foi possível atualizar a avaliação' }, { status: 500 });
  }
}
