import { createReadStream } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
await loadEnv(path.join(root, '.env.local'));

const bucket = required('AWS_S3_BUCKET_NAME');
const region = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: required('AWS_ACCESS_KEY_ID'),
    secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
  },
});
const files = (await walk(path.join(root, 'public'))).filter(isMediaFile);
if (!files.length) throw new Error('Nenhuma mídia local encontrada.');

const uploaded = [];
let next = 0;
const workers = Array.from({ length: 4 }, async () => {
  while (next < files.length) {
    const index = next++;
    const file = files[index];
    const relativePublic = path.relative(path.join(root, 'public'), file).split(path.sep).join('/');
    const key = `legacy-media/${relativePublic}`;
    const info = await stat(file);
    let alreadyUploaded = false;
    try {
      const existing = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      alreadyUploaded = existing.ContentLength === info.size;
    } catch (error) {
      if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound') throw error;
    }
    if (!alreadyUploaded) {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(file),
        ContentLength: info.size,
        ContentType: contentType(file),
        CacheControl: 'public, max-age=31536000, immutable',
        ServerSideEncryption: 'AES256',
        Metadata: { migratedFrom: relativePublic.slice(0, 900) },
      }));
    }
    uploaded[index] = {
      localPath: `/${relativePublic}`,
      key,
      url: publicUrl(key),
      size: info.size,
    };
    if ((index + 1) % 10 === 0 || index + 1 === files.length) {
      process.stdout.write(`Migradas ${index + 1}/${files.length}\n`);
    }
  }
});
await Promise.all(workers);

const manifest = {
  format: 'maistrilha-media-migration-v1',
  migratedAt: new Date().toISOString(),
  bucket,
  count: uploaded.length,
  totalBytes: uploaded.reduce((total, item) => total + item.size, 0),
  objects: uploaded,
};
await s3.send(new PutObjectCommand({
  Bucket: bucket,
  Key: 'legacy-media/manifest.json',
  Body: JSON.stringify(manifest),
  ContentType: 'application/json',
  ServerSideEncryption: 'AES256',
}));

await rewriteReferences(uploaded);
await saveManifestToSupabase(manifest);
await writeFile(path.join(root, '.media-migration-complete.json'), JSON.stringify({
  migratedAt: manifest.migratedAt,
  count: manifest.count,
  totalBytes: manifest.totalBytes,
  manifestKey: 'legacy-media/manifest.json',
}, null, 2));
process.stdout.write(`Migração concluída: ${manifest.count} arquivos (${manifest.totalBytes} bytes).\n`);

async function rewriteReferences(objects) {
  const candidates = [
    ...(await walk(path.join(root, 'src'))).filter(isTextFile),
    ...(await walk(path.join(root, 'public', 'bio'))).filter((file) => isTextFile(file) && !file.includes(`${path.sep}fotos_otimizadas${path.sep}`)),
  ];
  const replacements = new Map();
  for (const object of objects) {
    const raw = object.localPath;
    const encoded = raw.split('/').map((part, index) => index === 0 ? '' : encodeURIComponent(part)).join('/');
    replacements.set(raw, object.url);
    replacements.set(encoded, object.url);
    if (raw.startsWith('/bio/')) {
      const relative = raw.slice('/bio/'.length);
      const encodedRelative = encoded.slice('/bio/'.length);
      replacements.set(relative, object.url);
      replacements.set(encodedRelative, object.url);
    }
  }
  const orderedReplacements = [...replacements].sort((a, b) => b[0].length - a[0].length);
  for (const file of candidates) {
    const original = await readFile(file, 'utf8');
    let updated = original.replaceAll('/FotosEvideos//', '/FotosEvideos/');
    for (const [from, to] of orderedReplacements) updated = replaceOutsideHttpUrl(updated, from, to);
    if (updated !== original) await writeFile(file, updated, 'utf8');
  }
}

function replaceOutsideHttpUrl(text, from, to) {
  let cursor = 0;
  let output = '';
  while (true) {
    const index = text.indexOf(from, cursor);
    if (index < 0) return output + text.slice(cursor);
    const tokenStart = Math.max(
      text.lastIndexOf('"', index - 1), text.lastIndexOf("'", index - 1),
      text.lastIndexOf(' ', index - 1), text.lastIndexOf('\n', index - 1),
      text.lastIndexOf('(', index - 1),
    ) + 1;
    const tokenPrefix = text.slice(tokenStart, index);
    output += text.slice(cursor, index);
    output += /^https?:\/\//i.test(tokenPrefix) ? from : to;
    cursor = index + from.length;
  }
}

async function saveManifestToSupabase(manifest) {
  const supabase = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from('content_documents').upsert({
    document_key: 'legacy-media-manifest',
    title: 'Manifesto de migração de mídia para AWS S3',
    structured_content: manifest,
    mime_type: 'application/json',
    published: false,
    version: 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'document_key' });
  if (error) process.stderr.write(`Aviso: manifesto não gravado no Supabase: ${error.message}\n`);
}

async function walk(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    }));
    return nested.flat();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function loadEnv(file) {
  const content = await readFile(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

function publicUrl(key) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function isTextFile(file) {
  return /\.(?:js|mjs|cjs|ts|tsx|jsx|json|html|css|md|txt)$/i.test(file);
}

function isMediaFile(file) {
  return /\.(?:jpe?g|png|webp|heic|mp4|mov)$/i.test(file);
}

function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  return ({
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    '.heic': 'image/heic', '.mp4': 'video/mp4', '.mov': 'video/quicktime',
  })[extension] || 'application/octet-stream';
}
