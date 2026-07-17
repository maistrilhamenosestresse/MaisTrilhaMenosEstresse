import { NextResponse } from 'next/server';
import { getContractDefinition } from '@/lib/contracts';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { getAdminEmails } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });

  const { data: client } = await createSupabaseAdmin().from('clients').select('*').eq('id', id).maybeSingle();
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  const email = auth.user.email?.toLowerCase();
  const isAdmin = auth.user.app_metadata?.role === 'admin' || (!!email && getAdminEmails().includes(email));
  const isOwner = client.auth_user_id === auth.user.id || (!!email && client.email?.toLowerCase() === email);
  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { data: contracts } = await createSupabaseAdmin()
    .from('client_contracts')
    .select('id, contract_type, version, title, signature_url, signed_at, document_hash, document_snapshot')
    .eq('client_id', id)
    .order('signed_at', { ascending: false });

  return NextResponse.json({
    client,
    definitions: [
      getContractDefinition('responsibility'),
      getContractDefinition('insurance'),
    ],
    contracts: contracts || [],
  });
}
