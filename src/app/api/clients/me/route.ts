import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const client = await resolveClient(auth.user);
  if (!client) return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });
  return NextResponse.json({ client });
}

export async function PUT(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<Record<string, unknown>>(request, 100_000);
  if (parsed.response) return parsed.response;

  const client = await resolveClient(auth.user);
  if (!client) return NextResponse.json({ error: 'Cadastro não encontrado' }, { status: 404 });
  const updates = sanitizeUpdates(parsed.data);
  if ('error' in updates) return NextResponse.json({ error: updates.error }, { status: 400 });
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nenhuma alteração válida' }, { status: 400 });

  const { data, error } = await createSupabaseAdmin().from('clients')
    .update(updates)
    .eq('id', client.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Não foi possível atualizar o cadastro' }, { status: 400 });
  return NextResponse.json({ client: data });
}

async function resolveClient(user: User) {
  const supabase = createSupabaseAdmin();
  const { data: linked } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).maybeSingle();
  if (linked) return linked;
  if (!user.email) return null;

  const { data: byEmail } = await supabase.from('clients').select('*').ilike('email', user.email).limit(1).maybeSingle();
  if (!byEmail) return null;
  if (!byEmail.auth_user_id) {
    await supabase.from('clients').update({ auth_user_id: user.id }).eq('id', byEmail.id).is('auth_user_id', null);
    byEmail.auth_user_id = user.id;
  }
  return byEmail.auth_user_id === user.id ? byEmail : null;
}

function sanitizeUpdates(body: Record<string, unknown>): Record<string, unknown> | { error: string } {
  const stringLimits: Record<string, number> = {
    full_name: 150,
    rg: 30,
    birth_date: 10,
    phone: 30,
    emergency_contact_name: 150,
    emergency_contact_phone: 30,
    health_notes: 3000,
    photo_url: 1000,
    signature_url: 1000,
  };
  const result: Record<string, unknown> = {};
  for (const [key, limit] of Object.entries(stringLimits)) {
    if (!(key in body)) continue;
    if (typeof body[key] !== 'string' || body[key].length > limit) return { error: `Campo ${key} inválido` };
    result[key] = body[key].trim();
  }
  if ('image_authorization' in body) {
    if (typeof body.image_authorization !== 'boolean') return { error: 'Autorização de imagem inválida' };
    result.image_authorization = body.image_authorization;
  }
  if (typeof result.full_name === 'string' && result.full_name.length < 3) return { error: 'Nome inválido' };
  if (typeof result.phone === 'string' && result.phone.replace(/\D/g, '').length < 10) return { error: 'Telefone inválido' };
  if (typeof result.birth_date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(result.birth_date)) return { error: 'Nascimento inválido' };
  for (const key of ['photo_url', 'signature_url']) {
    const value = result[key];
    if (typeof value === 'string' && value && !isAllowedMediaUrl(value)) return { error: 'URL de mídia inválida' };
  }
  return result;
}

function isAllowedMediaUrl(value: string) {
  try {
    const url = new URL(value);
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || 'us-east-1';
    return !!bucket && url.protocol === 'https:' && url.hostname === `${bucket}.s3.${region}.amazonaws.com`;
  } catch {
    return false;
  }
}
