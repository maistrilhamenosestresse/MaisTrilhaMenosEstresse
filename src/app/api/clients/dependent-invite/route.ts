import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { signRegistrationNotification } from '@/lib/server/registration-notification';
import { enforceRateLimit } from '@/lib/server/rate-limit';

type CompletionBody = {
  token?: string;
  full_name?: string; email?: string; cpf?: string; rg?: string; birth_date?: string;
  phone?: string; emergency_contact_name?: string; emergency_contact_phone?: string;
  health_notes?: string; photo_url?: string; image_authorization?: boolean; signature_url?: string;
  accepted_terms?: boolean;
};

export async function GET(request: Request) {
  const rateLimit = await enforceRateLimit(request, 'dependent-invite-read', 30, 3600);
  if (rateLimit) return rateLimit;
  const token = new URL(request.url).searchParams.get('token') || '';
  if (token.length < 32 || token.length > 100) return NextResponse.json({ error: 'Convite inválido' }, { status: 400 });
  const supabase = createSupabaseAdmin();
  const { data: invite } = await supabase.from('dependent_registration_invites')
    .select('client_id, expires_at, used_at, clients!dependent_registration_invites_client_id_fkey(full_name, cpf, phone)')
    .eq('token_hash', hashToken(token)).maybeSingle();
  if (!invite || invite.used_at || new Date(invite.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 410 });
  }
  const client = invite.clients as any;
  return NextResponse.json({
    invite: { full_name: client?.full_name || '', cpf: client?.cpf || '', phone: client?.phone || '' },
  });
}

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, 'dependent-invite-complete', 10, 3600);
  if (rateLimit) return rateLimit;
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const parsed = await readJsonBody<CompletionBody>(request, 100_000);
  if (parsed.response) return parsed.response;
  const input = parsed.data;
  const token = String(input.token || '');
  const cpf = String(input.cpf || '').replace(/\D/g, '');
  const phone = String(input.phone || '').replace(/\D/g, '');
  const email = String(input.email || '').trim().toLowerCase();
  if (
    token.length < 32 || String(input.full_name || '').trim().length < 3 || !/^\S+@\S+\.\S+$/.test(email) ||
    cpf.length !== 11 || phone.length < 10 || String(input.rg || '').trim().length < 4 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(input.birth_date || '')) ||
    String(input.emergency_contact_name || '').trim().length < 3 ||
    String(input.emergency_contact_phone || '').replace(/\D/g, '').length < 10 || input.accepted_terms !== true
  ) {
    return NextResponse.json({ error: 'Revise os dados obrigatórios' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: invite } = await supabase.from('dependent_registration_invites')
    .select('id, client_id, expires_at, used_at, clients!dependent_registration_invites_client_id_fkey(cpf)')
    .eq('token_hash', hashToken(token)).maybeSingle();
  if (!invite || invite.used_at || new Date(invite.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 410 });
  }
  const invitedClient = invite.clients as any;
  if (String(invitedClient?.cpf || '').replace(/\D/g, '') !== cpf) {
    return NextResponse.json({ error: 'CPF não corresponde ao convite' }, { status: 403 });
  }
  const { data: emailOwner } = await supabase.from('clients').select('id').ilike('email', email).neq('id', invite.client_id).limit(1).maybeSingle();
  if (emailOwner) return NextResponse.json({ error: 'E-mail já usado em outro cadastro' }, { status: 409 });
  if (!validAwsUrls([input.photo_url, input.signature_url])) {
    return NextResponse.json({ error: 'URL de documento inválida' }, { status: 400 });
  }

  const { data: client, error } = await supabase.from('clients').update({
    full_name: String(input.full_name).trim().slice(0, 150),
    email,
    rg: String(input.rg).trim().slice(0, 30),
    birth_date: input.birth_date,
    phone: input.phone,
    emergency_contact_name: String(input.emergency_contact_name).trim().slice(0, 150),
    emergency_contact_phone: String(input.emergency_contact_phone).trim().slice(0, 30),
    health_notes: String(input.health_notes || '').trim().slice(0, 3000),
    photo_url: input.photo_url || null,
    image_authorization: input.image_authorization === true,
    signature_url: input.signature_url || null,
    accepted_terms_at: new Date().toISOString(),
  }).eq('id', invite.client_id).select('*').single();
  if (error) return NextResponse.json({ error: 'Não foi possível concluir o cadastro' }, { status: 400 });
  await supabase.from('dependent_registration_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id).is('used_at', null);
  return NextResponse.json({ success: true, client, notificationToken: signRegistrationNotification(client.id) });
}

function validAwsUrls(values: Array<string | undefined>) {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'us-east-1';
  return values.filter(Boolean).every((value) => {
    try {
      const url = new URL(value!);
      return !!bucket && url.protocol === 'https:' && url.hostname === `${bucket}.s3.${region}.amazonaws.com`;
    } catch { return false; }
  });
}

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
