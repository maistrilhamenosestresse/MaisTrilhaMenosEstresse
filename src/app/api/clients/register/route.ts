import { NextResponse } from 'next/server';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { requireServerEnv } from '@/lib/server/env';
import { signRegistrationNotification } from '@/lib/server/registration-notification';
import { enforceRateLimit } from '@/lib/server/rate-limit';

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
  const emergencyPhone = String(input.emergency_contact_phone || '').replace(/\D/g, '');

  if (
    name.length < 3 || name.length > 150 || !/^\S+@\S+\.\S+$/.test(email) ||
    !isValidCpf(cpf) || phone.length < 10 || phone.length > 11 ||
    !isValidPastDate(birthDate) || String(input.rg || '').trim().length < 4 ||
    String(input.emergency_contact_name || '').trim().length < 3 || emergencyPhone.length < 10 ||
    input.accepted_terms !== true
  ) {
    return NextResponse.json({ error: 'Revise os dados obrigatórios e o aceite dos termos' }, { status: 400 });
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
    supabase.from('clients').select('id').in('cpf', [formatCpf(cpf), cpf]).limit(1).maybeSingle(),
    supabase.from('clients').select('id').ilike('email', email).limit(1).maybeSingle(),
  ]);
  if (cpfMatch || emailMatch) {
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
  const { data: client, error } = await supabase.from('clients').insert(payload)
    .select('id, full_name, email, cpf, phone').single();
  if (error) {
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro' }, { status: 400 });
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

function isValidPastDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date < new Date();
}

function isValidCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digit = (length: number) => {
    const sum = value.slice(0, length).split('').reduce(
      (total, number, index) => total + Number(number) * (length + 1 - index),
      0,
    );
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}
