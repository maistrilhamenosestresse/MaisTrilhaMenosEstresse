import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

await loadEnv(path.join(process.cwd(), '.env.local'));
const bucket = required('AWS_S3_BUCKET_NAME');
const region = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: required('AWS_ACCESS_KEY_ID'),
    secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
  },
});
const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: 'legacy-media/manifest.json' }));
const manifest = JSON.parse(await object.Body.transformToString());
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
if (error) throw error;
process.stdout.write(`Manifesto com ${manifest.count} objetos sincronizado no Supabase.\n`);

async function loadEnv(file) {
  const content = await readFile(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}
