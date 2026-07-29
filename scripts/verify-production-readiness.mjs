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
const officialSiteUrl = 'https://www.maistrilhasmenosestresse.com';
const officialWebhookUrl = `${officialSiteUrl}/api/webhooks/asaas`;
const officialInfinitePayWebhookUrl = `${officialSiteUrl}/api/webhooks/infinitepay`;

const requiredVariables = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_EMAILS',
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_TOKEN',
  'INFINITEPAY_HANDLE',
  'WEB_PUSH_VAPID_SUBJECT',
  'WEB_PUSH_VAPID_PUBLIC_KEY',
  'WEB_PUSH_VAPID_PRIVATE_KEY',
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

if (!allowSandbox) checkProductionUrls();

const secretNames = ['ASAAS_WEBHOOK_TOKEN', 'CRON_SECRET', 'RATE_LIMIT_SECRET', 'REGISTRATION_SIGNING_SECRET', 'WEB_PUSH_VAPID_PRIVATE_KEY'];
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
checkInfinitePay();
checkWebPush();
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
      'backup_restore_tests', 'api_rate_limits', 'pedidos_loja',
      'infinitepay_checkouts', 'push_subscriptions', 'push_campaigns',
      'client_contracts', 'contract_signing_invites', 'loyalty_program_config',
      'loyalty_award_decisions', 'loyalty_balance_snapshots',
    ];
    const rpcs = [
      'consume_api_rate_limit', 'redeem_campaign_coupon', 'create_pending_reservation_batch',
      'claim_reservation_checkout', 'finalize_trail_payment', 'cancel_trail_payment',
      'release_reservation_checkout_claim', 'create_store_order',
      'finalize_store_order_from_asaas', 'cancel_store_order',
      'credit_wallet_from_asaas', 'reverse_wallet_credit_from_asaas',
      'credit_wallet_from_provider',
      'award_points_from_asaas', 'increment_agenda_views',
      'get_loyalty_financial_summary', 'loyalty_points_for_amount',
      'quote_app_trail_points', 'record_loyalty_balance_snapshot',
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

    const { data: verifiedBackup, error: backupError } = await supabase
      .from('backup_runs')
      .select('id, completed_at, integrity_verified_at')
      .eq('status', 'completed')
      .not('integrity_verified_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (backupError) {
      failures.push(`não foi possível verificar o último backup: ${safeMessage(backupError)}`);
    } else if (!verifiedBackup) {
      failures.push('nenhum backup concluído passou pelo teste de restauração/integridade');
    } else {
      const { data: restoreTest, error: restoreError } = await supabase
        .from('backup_restore_tests')
        .select('id')
        .eq('backup_run_id', verifiedBackup.id)
        .eq('status', 'completed')
        .eq('database_checksum_valid', true)
        .eq('manifest_checksum_valid', true)
        .limit(1)
        .maybeSingle();
      if (restoreError) {
        failures.push(`não foi possível verificar o teste de restauração: ${safeMessage(restoreError)}`);
      } else if (!restoreTest) {
        failures.push('o backup marcado como íntegro não possui teste de restauração concluído');
      }
    }

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

  for (const table of [
    'clients', 'reservas', 'asaas_payments', 'backup_runs', 'audit_logs',
    'client_contracts', 'contract_signing_invites', 'loyalty_program_config',
    'loyalty_award_decisions', 'loyalty_balance_snapshots',
  ]) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
    if (response.ok) {
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length > 0) {
        failures.push(`acesso anônimo indevido permitido em ${table}`);
      }
    }
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
    const accessToken = required('ASAAS_API_KEY').replace(/^\\(?=\$aact_)/, '');
    const asaasHost = new URL(baseUrl).hostname;
    if (asaasHost.includes('sandbox') && !allowSandbox) {
      failures.push('Asaas ainda está no ambiente sandbox; use https://api.asaas.com/v3 para produção');
    }
    const response = await fetch(`${baseUrl}/customers?limit=1&offset=0`, {
      headers: {
        access_token: accessToken,
        'user-agent': 'MaisTrilha/production-readiness',
      },
    });
    if (!response.ok) throw new Error(`API retornou HTTP ${response.status}`);
    successes.push(`Asaas: credencial e API acessíveis (${asaasHost.includes('sandbox') ? 'sandbox' : 'produção'})`);
  } catch (error) {
    failures.push(`Asaas indisponível ou mal configurada: ${safeMessage(error)}`);
  }
}

function checkInfinitePay() {
  try {
    const handle = required('INFINITEPAY_HANDLE')
      .replace(/^\\?(?=\$)/, '')
      .replace(/^\$/, '')
      .trim();
    if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(handle)) {
      throw new Error('INFINITEPAY_HANDLE inválido');
    }

    const apiUrl = new URL(
      (process.env.INFINITEPAY_API_URL || 'https://api.checkout.infinitepay.io').replace(/\/$/, ''),
    );
    if (apiUrl.protocol !== 'https:' || apiUrl.hostname !== 'api.checkout.infinitepay.io') {
      throw new Error('INFINITEPAY_API_URL deve usar https://api.checkout.infinitepay.io');
    }

    const publicUrl = (process.env.INFINITEPAY_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    if (!allowSandbox && publicUrl !== officialSiteUrl) {
      failures.push(`INFINITEPAY_PUBLIC_BASE_URL deve usar o domínio oficial ${officialSiteUrl}`);
      return;
    }
    successes.push(`InfinitePay: InfiniteTag e endpoints validados (${officialInfinitePayWebhookUrl})`);
  } catch (error) {
    failures.push(`InfinitePay mal configurada: ${safeMessage(error)}`);
  }
}

function checkWebPush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || '';
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || '';
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || '';
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(publicKey)) {
    failures.push('WEB_PUSH_VAPID_PUBLIC_KEY inválida');
    return;
  }
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(privateKey)) {
    failures.push('WEB_PUSH_VAPID_PRIVATE_KEY inválida');
    return;
  }
  if (!/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(subject) && !/^https:\/\//.test(subject)) {
    failures.push('WEB_PUSH_VAPID_SUBJECT inválido');
    return;
  }
  successes.push('Web Push: chaves VAPID e estrutura de inscrições configuradas');
}

function checkProductionUrls() {
  const productionUrls = ['NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_SITE_URL'];
  for (const name of productionUrls) {
    const value = process.env[name]?.trim().replace(/\/+$/, '');
    if (!value) {
      failures.push(`variável obrigatória ausente em produção: ${name}`);
    } else if (value !== officialSiteUrl) {
      failures.push(`${name} deve usar o domínio oficial ${officialSiteUrl}`);
    }
  }
  if (!failures.some((failure) => /NEXT_PUBLIC_BASE_URL|NEXT_PUBLIC_SITE_URL/.test(failure))) {
    successes.push(`Site: domínio oficial, webhook Asaas (${officialWebhookUrl}) e InfinitePay (${officialInfinitePayWebhookUrl})`);
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
