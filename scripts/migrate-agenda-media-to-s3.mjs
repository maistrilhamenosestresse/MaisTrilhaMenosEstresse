import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

await loadEnv(path.join(process.cwd(), '.env.local'));

const applyChanges = process.argv.includes('--apply');
const bucket = required('AWS_S3_BUCKET_NAME');
const region = process.env.AWS_REGION || 'us-east-1';
const ownHost = `${bucket}.s3.${region}.amazonaws.com`;
const supabase = createClient(
  required('NEXT_PUBLIC_SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const s3 = new S3Client({
  region,
  requestStreamBufferSize: 64 * 1024,
  credentials: {
    accessKeyId: required('AWS_ACCESS_KEY_ID'),
    secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
  },
});

const { data: agendas, error } = await supabase
  .from('agendas')
  .select('id, title, flyer_url, images, video_url')
  .order('date', { ascending: false });
if (error) throw error;

const { data: previousManifest } = await supabase
  .from('content_documents')
  .select('structured_content')
  .eq('document_key', 'agenda-media-aws-migration')
  .maybeSingle();
const previousFailures = Array.isArray(previousManifest?.structured_content?.failures)
  ? previousManifest.structured_content.failures
  : [];
const retryUrlsByAgenda = new Map();
for (const failure of previousFailures) {
  if (!failure?.agendaId || !failure?.sourceUrl) continue;
  const current = retryUrlsByAgenda.get(failure.agendaId) || [];
  current.push(failure.sourceUrl);
  retryUrlsByAgenda.set(failure.agendaId, current);
}

const candidates = (agendas || [])
  .map((agenda) => ({
    agenda,
    urls: uniqueUrls([
      agenda.flyer_url,
      ...(Array.isArray(agenda.images) ? agenda.images : []),
      agenda.video_url,
      ...(retryUrlsByAgenda.get(agenda.id) || []),
    ]).filter(needsMigration),
  }))
  .filter((item) => item.urls.length > 0);

process.stdout.write(
  `${candidates.length} agenda(s), ${candidates.reduce((total, item) => total + item.urls.length, 0)} mídia(s) fora da AWS.\n`,
);
if (!applyChanges) {
  process.stdout.write('Simulação concluída. Use --apply para copiar e atualizar o Supabase.\n');
} else {
  await applyMigration();
}
s3.destroy();

async function applyMigration() {
  const migrated = [];
  const failures = [];
  for (const { agenda, urls } of candidates) {
    const replacements = new Map();
    const unavailable = new Set();
    const currentUrls = new Set(uniqueUrls([
      agenda.flyer_url,
      ...(Array.isArray(agenda.images) ? agenda.images : []),
      agenda.video_url,
    ]));
    for (const sourceUrl of urls) {
      try {
        replacements.set(sourceUrl, await migrateObject(sourceUrl, agenda.id));
      } catch (migrationError) {
        const reason = String(migrationError?.message || migrationError).slice(0, 500);
        unavailable.add(sourceUrl);
        failures.push({ agendaId: agenda.id, title: agenda.title, sourceUrl, reason });
        process.stderr.write(`Mídia indisponível em ${agenda.title || agenda.id}: ${reason}\n`);
      }
    }

    const migratedImages = Array.isArray(agenda.images)
      ? agenda.images
        .filter((url) => !unavailable.has(url))
        .map((url) => replaceUrl(url, replacements))
        .filter(Boolean)
      : [];
    for (const [sourceUrl, destinationUrl] of replacements) {
      if (!currentUrls.has(sourceUrl) && mediaKind(sourceUrl) === 'image') {
        migratedImages.push(destinationUrl);
      }
    }
    const retryFlyer = [...replacements].find(
      ([sourceUrl]) => !currentUrls.has(sourceUrl) && mediaKind(sourceUrl) === 'flyer',
    )?.[1];
    const retryVideo = [...replacements].find(
      ([sourceUrl]) => !currentUrls.has(sourceUrl) && mediaKind(sourceUrl) === 'video',
    )?.[1];
    const flyerUrl = unavailable.has(agenda.flyer_url)
      ? migratedImages[0] || retryFlyer || null
      : replaceUrl(agenda.flyer_url, replacements) || retryFlyer || migratedImages[0] || null;
    const update = {
      flyer_url: flyerUrl,
      images: uniqueUrls(migratedImages),
      video_url: unavailable.has(agenda.video_url)
        ? null
        : replaceUrl(agenda.video_url, replacements) || retryVideo || null,
    };
    const { error: updateError } = await supabase
      .from('agendas')
      .update(update)
      .eq('id', agenda.id);
    if (updateError) throw updateError;

    migrated.push({
      agendaId: agenda.id,
      title: agenda.title,
      objects: [...replacements].map(([sourceUrl, destinationUrl]) => ({
        sourceUrl,
        destinationUrl,
      })),
      unavailable: failures.filter((item) => item.agendaId === agenda.id),
    });
    process.stdout.write(
      `Atualizada: ${agenda.title || agenda.id} (${replacements.size} migrada(s), ${unavailable.size} indisponível(is))\n`,
    );
  }

  const completedAt = new Date().toISOString();
  const { error: manifestError } = await supabase.from('content_documents').upsert({
    document_key: 'agenda-media-aws-migration',
    title: 'Migração das mídias das agendas para AWS S3',
    structured_content: {
      format: 'maistrilha-agenda-media-migration-v1',
      completedAt,
      bucket,
      agendas: migrated,
      failures,
    },
    mime_type: 'application/json',
    published: false,
    version: 1,
    updated_at: completedAt,
  }, { onConflict: 'document_key' });
  if (manifestError) throw manifestError;

  process.stdout.write(
    `Migração concluída: ${migrated.length} agenda(s), ${failures.length} mídia(s) de origem indisponível(is). URLs ativas agora apontam para ${ownHost}.\n`,
  );
}

async function migrateObject(sourceUrl, agendaId) {
  const source = new URL(sourceUrl);
  if (source.protocol !== 'https:' || !isAllowedSourceHost(source.hostname)) {
    throw new Error(`Origem de mídia não permitida: ${source.hostname}`);
  }

  const response = await fetch(source, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar mídia (${response.status}): ${source.pathname}`);
  }

  const contentType = normalizeContentType(response.headers.get('content-type'), source.pathname);
  const mediaType = contentType.startsWith('video/') ? 'videos' : 'images';
  const maxBytes = mediaType === 'videos' ? 500 * 1024 * 1024 : 20 * 1024 * 1024;
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > maxBytes) {
    await response.body.cancel();
    throw new Error(`Tamanho de mídia inválido para ${source.pathname}`);
  }

  const digest = createHash('sha256').update(sourceUrl).digest('hex');
  const extension = extensionFor(contentType);
  const key = `media/migrated/${mediaType}/${agendaId}/${digest}.${extension}`;

  let exists = false;
  try {
    const current = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    exists = current.ContentLength === contentLength;
  } catch (headError) {
    if (headError?.$metadata?.httpStatusCode !== 404 && headError?.name !== 'NotFound') throw headError;
  }

  if (!exists) {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Readable.fromWeb(response.body),
      ContentLength: contentLength,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
      ServerSideEncryption: 'AES256',
      Metadata: {
        agendaId,
        migratedFromHash: digest,
      },
    }));
  } else {
    await response.body.cancel();
  }

  return `https://${ownHost}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function needsMigration(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    return new URL(value).hostname !== ownHost;
  } catch {
    return true;
  }
}

function isAllowedSourceHost(hostname) {
  return hostname.endsWith('.supabase.co') || hostname === ownHost;
}

function uniqueUrls(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}

function replaceUrl(value, replacements) {
  if (typeof value !== 'string' || !value) return null;
  return replacements.get(value) || value;
}

function mediaKind(sourceUrl) {
  try {
    const pathname = new URL(sourceUrl).pathname.toLowerCase();
    if (/\.(?:mp4|mov)$/.test(pathname) || pathname.includes('/vid_')) return 'video';
    if (pathname.includes('/flyer_')) return 'flyer';
    return 'image';
  } catch {
    return 'image';
  }
}

function normalizeContentType(header, pathname) {
  const value = String(header || '').split(';')[0].trim().toLowerCase();
  const allowed = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime',
  ]);
  if (allowed.has(value)) return value;

  const extension = path.extname(pathname).toLowerCase();
  const inferred = ({
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
  })[extension];
  if (!inferred) throw new Error(`Tipo de mídia não permitido: ${value || extension || 'desconhecido'}`);
  return inferred;
}

function extensionFor(contentType) {
  return ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
  })[contentType];
}

async function loadEnv(file) {
  const content = await readFile(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}
