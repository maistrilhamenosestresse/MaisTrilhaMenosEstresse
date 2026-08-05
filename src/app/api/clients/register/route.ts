import { NextResponse } from 'next/server';
import type { ContractType } from '@/lib/contracts';
import { signClientContracts } from '@/lib/server/client-contracts';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { requireServerEnv } from '@/lib/server/env';
import { signRegistrationNotification } from '@/lib/server/registration-notification';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { validateRegistrationInput } from '@/lib/registration-validation';

type RegistrationBody = {
  full_name?: string;
  email?: string;
  cpf?: string;
  rg?: string;
  birth_date?: string;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  health_notes?: string;
  photo_url?: string;
  image_authorization?: boolean;
  signature_url?: string;
  accepted_terms?: boolean;
};

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, 'client-register', 5, 3600);
  if (rateLimit) return rateLimit;
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const parsed = await readJsonBody<RegistrationBody>(request, 100_000);
  if (parsed.response) return parsed.response;

  const input = parsed.data;
  const cpf = String(input.cpf || '').replace(/\D/g, '');
  const phone = String(input.phone || '').replace(/\D/g, '');
  const email = String(input.email || '').trim().toLowerCase();
  const name = String(input.full_name || '').trim();
  const birthDate = String(input.birth_date || '');

  const validationError = validateRegistrationInput(input);
  if (validationError) {
    return NextResponse.json({
      error: validationError.message,
      field: validationError.field,
      step: validationError.step,
    }, { status: 400 });
  }

  const bucket = requireServerEnv('AWS_S3_BUCKET_NAME');
  const region = process.env.AWS_REGION || 'us-east-1';
  const allowedAwsHost = `${bucket}.s3.${region}.amazonaws.com`;
  for (const value of [input.photo_url, input.signature_url].filter(Boolean) as string[]) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return NextResponse.json({ error: 'URL de documento inválida' }, { status: 400 });
    }
    if (url.protocol !== 'https:' || url.hostname !== allowedAwsHost) {
      return NextResponse.json({ error: 'URL de documento inválida' }, { status: 400 });
    }
  }

  const supabase = createSupabaseAdmin();
  const [{ data: cpfMatch }, { data: emailMatch }] = await Promise.all([
    supabase.from('clients').select('id, email').in('cpf', [formatCpf(cpf), cpf]).limit(1).maybeSingle(),
    supabase.from('clients').select('id').ilike('email', email).limit(1).maybeSingle(),
  ]);

  let existingDependentId: string | null = null;

  if (cpfMatch && !cpfMatch.email) {
    // É um dependente que foi adicionado em uma reserva, mas não tem e-mail.
    // Vamos permitir que ele conclua o cadastro atualizando este registro.
    existingDependentId = cpfMatch.id;
  } else if (cpfMatch || emailMatch) {
    return NextResponse.json({
      error: 'Cadastro já existente. Entre com o código enviado ao e-mail para atualizar seus dados.',
      existing: true,
    }, { status: 409 });
  }

  const payload = {
    full_name: name,
    email,
    cpf: formatCpf(cpf),
    rg: String(input.rg || '').trim().slice(0, 30),
    birth_date: birthDate,
    phone: formatPhone(phone),
    emergency_contact_name: String(input.emergency_contact_name || '').trim().slice(0, 150),
    emergency_contact_phone: String(input.emergency_contact_phone || '').trim().slice(0, 30),
    health_notes: String(input.health_notes || '').trim().slice(0, 3000),
    photo_url: input.photo_url || null,
    image_authorization: input.image_authorization === true,
    signature_url: input.signature_url || null,
    accepted_terms_at: new Date().toISOString(),
  };

  let client;

  if (existingDependentId) {
    const { data, error } = await supabase.from('clients').update(payload).eq('id', existingDependentId).select('*').single();
    if (error) {
      return NextResponse.json({ error: 'Não foi possível atualizar o cadastro do dependente' }, { status: 400 });
    }
    client = data;
  } else {
    const { data, error } = await supabase.from('clients').insert(payload).select('*').single();
    if (error) {
      return NextResponse.json({ error: 'Não foi possível concluir o cadastro' }, { status: 400 });
    }
    client = data;
  }

  try {
    await signClientContracts({
      client,
      signatureUrl: String(input.signature_url || ''),
      request,
      types: ['responsibility', 'insurance'] satisfies ContractType[],
      source: 'registration',
    });
  } catch (contractError: any) {
    await supabase.from('clients').delete().eq('id', client.id);
    return NextResponse.json({
      error: contractError.message || 'Não foi possível registrar os contratos assinados',
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    client,
    notificationToken: signRegistrationNotification(client.id),
  });
}

function formatCpf(value: string) {
  return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatPhone(value: string) {
  return value.length === 11
    ? value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    : value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}
