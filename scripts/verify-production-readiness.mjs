import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetPublicAccessBlockCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

await loadEnv(path.join(process.cwd(), '.env.local'));

const failures = [];
const successes = [];
const allowSandbox = process.argv.includes('--allow-sandbox');

const requiredVariables = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_EMAILS',
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_TOKEN',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
  'AWS_BACKUP_BUCKET_NAME',
  'CRON_SECRET',
  'RATE_LIMIT_SECRET',
  'REGISTRATION_SIGNING_SECRET',
];

for (const name of requiredVariables) {
  if (!process.env[name]?.trim()) failures.push(`variável obrigatória ausente: ${name}`);
}

const secretNames = ['ASAAS_WEBHOOK_TOKEN', 'CRON_SECRET', 'RATE_LIMIT_SECRET', 'REGISTRATION_SIGNING_SECRET', 'NEXTAUTH_SECRET'];
const configuredSecrets = [];
for (const name of secretNames) {
  const value = process.env[name]?.trim();
  if (!value) continue;
  configuredSecrets.push([name, value]);
  if (value.length < 32) failures.push(`${name} deve ter pelo menos 32 caracteres aleatórios`);
}
for (let i = 0; i < configuredSecrets.length; i++) {
  for (let j = i + 1; j < configuredSecrets.length; j++) {
    if (configuredSecrets[i][1] === configuredSecrets[j][1]) {
      failures.push(`${configuredSecrets[i][0]} e ${configuredSecrets[j][0]} não podem compartilhar o mesmo segredo`);
    }
  }
}

const connectivityVariables = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ASAAS_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
  'AWS_BACKUP_BUCKET_NAME',
];
if (connectivityVariables.some((name) => !process.env[name]?.trim())) finish();

await checkSupabase();
await checkAws();
await checkAsaas();
finish();

async function checkSupabase() {
  try {
    const url = required('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
    const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const failureCountBefore = failures.length;
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        accept: 'application/openapi+json',
      },
    });
    if (!response.ok) throw new Error(`OpenAPI retornou HTTP ${response.status}`);
    const schema = await response.json();
    const paths = new Set(Object.keys(schema.paths || {}));
    const tables = [
      'agendas', 'clients', 'reservas', 'profiles', 'wallet_transactions',
      'points_transactions', 'content_documents', 'asaas_webhook_events',
      'asaas_payments', 'audit_logs', 'backup_runs', 'dependent_registration_invites',
      'api_rate_limits', 'pedidos_loja',
    ];
    const rpcs = [
      'consume_api_rate_limit', 'redeem_campaign_coupon', 'create_pending_reservation_batch',
      'claim_reservation_checkout', 'finalize_trail_payment', 'cancel_trail_payment',
      'release_reservation_checkout_claim', 'create_store_order',
      'finalize_store_order_from_asaas', 'cancel_store_order',
      'credit_wallet_from_asaas', 'reverse_wallet_credit_from_asaas',
      'award_points_from_asaas', 'increment_agenda_views',
    ];
    for (const table of tables) {
      if (!paths.has(`/${table}`)) failures.push(`tabela Supabase ausente: ${table}`);
    }
    for (const rpc of rpcs) {
      if (!paths.has(`/rpc/${rpc}`)) failures.push(`RPC Supabase ausente: ${rpc}`);
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase
      .from('content_documents')
      .select('document_key')
      .eq('document_key', 'legacy-media-manifest')
      .maybeSingle();
    if (error) failures.push(`não foi possível verificar content_documents: ${safeMessage(error)}`);
    else if (!data) failures.push('manifesto de mídias ainda não foi sincronizado em content_documents');

    await checkAnonymousSupabaseBoundaries(url, anonKey);
    if (failures.length === failureCountBefore) {
      successes.push('Supabase: esquema, RLS, privilégios e manifesto de mídias');
    }
  } catch (error) {
    failures.push(`Supabase indisponível: ${safeMessage(error)}`);
  }
}

async function checkAnonymousSupabaseBoundaries(url, anonKey) {
  const headers = { apikey: anonKey, authorization: `Bearer ${anonKey}` };
  const publicAgenda = await fetch(`${url}/rest/v1/agendas?select=id&limit=1`, { headers });
  if (!publicAgenda.ok) failures.push(`leitura pública de agendas bloqueada: HTTP ${publicAgenda.status}`);

  for (const table of ['clients', 'reservas', 'asaas_payments', 'backup_runs', 'audit_logs']) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
    if (response.ok) failures.push(`acesso anônimo indevido permitido em ${table}`);
  }

  const unpublished = await fetch(`${url}/rest/v1/content_documents?select=id&published=eq.false&limit=1`, { headers });
  if (!unpublished.ok) {
    failures.push(`política pública de content_documents inválida: HTTP ${unpublished.status}`);
  } else {
    const rows = await unpublished.json();
    if (Array.isArray(rows) && rows.length > 0) failures.push('documento não publicado visível anonimamente');
  }

  const forbiddenUpdate = await fetch(`${url}/rest/v1/agendas?id=eq.00000000-0000-0000-0000-000000000000`, {
    method: 'PATCH',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'security-readiness-probe' }),
  });
  if (forbiddenUpdate.ok) failures.push('alteração anônima de agendas não foi rejeitada');
}

async function checkAws() {
  try {
    const sourceBucket = required('AWS_S3_BUCKET_NAME');
    const backupBucket = required('AWS_BACKUP_BUCKET_NAME');
    if (sourceBucket === backupBucket) {
      failures.push('o bucket de backup deve ser diferente do bucket de mídia');
      return;
    }
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: required('AWS_ACCESS_KEY_ID'),
        secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
      },
    });
    await s3.send(new HeadBucketCommand({ Bucket: sourceBucket }));
    await s3.send(new HeadObjectCommand({ Bucket: sourceBucket, Key: 'legacy-media/manifest.json' }));
    await s3.send(new HeadBucketCommand({ Bucket: backupBucket }));

    const [versioning, publicAccess, encryption] = await Promise.all([
      s3.send(new GetBucketVersioningCommand({ Bucket: backupBucket })),
      s3.send(new GetPublicAccessBlockCommand({ Bucket: backupBucket })),
      s3.send(new GetBucketEncryptionCommand({ Bucket: backupBucket })),
    ]);
    if (versioning.Status !== 'Enabled') failures.push('versionamento do bucket de backup não está habilitado');
    const block = publicAccess.PublicAccessBlockConfiguration;
    if (!block || !block.BlockPublicAcls || !block.IgnorePublicAcls || !block.BlockPublicPolicy || !block.RestrictPublicBuckets) {
      failures.push('bloqueio de acesso público do bucket de backup está incompleto');
    }
    if (!encryption.ServerSideEncryptionConfiguration?.Rules?.length) {
      failures.push('criptografia padrão do bucket de backup não está configurada');
    }
    if (!failures.some((failure) => /bucket|AWS|manifest\.json/i.test(failure))) {
      successes.push('AWS: mídia, manifesto e bucket privado/versionado de backup');
    }
  } catch (error) {
    failures.push(`AWS indisponível ou mal configurada: ${safeMessage(error)}`);
  }
}

async function checkAsaas() {
  try {
    const baseUrl = (process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').replace(/\/$/, '');
    const asaasHost = new URL(baseUrl).hostname;
    if (asaasHost.includes('sandbox') && !allowSandbox) {
      failures.push('Asaas ainda está no ambiente sandbox; use https://api.asaas.com/v3 para produção');
    }
    const response = await fetch(`${baseUrl}/customers?limit=1&offset=0`, {
      headers: {
        access_token: required('ASAAS_API_KEY'),
        'user-agent': 'MaisTrilha/production-readiness',
      },
    });
    if (!response.ok) throw new Error(`API retornou HTTP ${response.status}`);
    successes.push(`Asaas: credencial e API acessíveis (${asaasHost.includes('sandbox') ? 'sandbox' : 'produção'})`);
  } catch (error) {
    failures.push(`Asaas indisponível ou mal configurada: ${safeMessage(error)}`);
  }
}

function finish() {
  for (const message of successes) process.stdout.write(`OK  ${message}\n`);
  if (failures.length) {
    process.stderr.write(`\nSistema ainda não está pronto para produção:\n- ${[...new Set(failures)].join('\n- ')}\n`);
    process.exit(1);
  }
  process.stdout.write(`\nSistema pronto para ${allowSandbox ? 'testes integrados' : 'produção'} nos serviços verificados.\n`);
  process.exit(0);
}

async function loadEnv(file) {
  try {
    const content = await readFile(file, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`variável obrigatória ausente: ${name}`);
  return value;
}

function safeMessage(error) {
  return String(error?.message || error).replace(/[\r\n]+/g, ' ').slice(0, 300);
}
