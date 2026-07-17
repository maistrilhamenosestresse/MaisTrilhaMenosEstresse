import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

// POST - Atualizar status de membro de um cliente
export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const parsed = await readJsonBody<{ clientId?: string; membro_vip?: boolean }>(request, 10_000);
    if (parsed.response) return parsed.response;
    const { clientId, membro_vip } = parsed.data;
    if (!clientId) return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 });

    const { error } = await createSupabaseAdmin()
      .from('clients')
      .update({ membro_vip: Boolean(membro_vip) })
      .eq('id', clientId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
