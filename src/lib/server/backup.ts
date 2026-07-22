import 'server-only';

import { createHash } from 'crypto';
import { gzipSync } from 'zlib';
import { CopyObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutBucketVersioningCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from '@/lib/aws';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { requireServerEnv } from '@/lib/server/env';

const BACKUP_TABLES = [
  'agendas', 'global_stats', 'clients', 'avaliacoes', 'trilha_custos', 'reservas',
  'notificacoes', 'coupon_redemptions', 'bolao_apostas', 'settings', 'trilha_gpx',
  'fotos_trilhas', 'produtos', 'pedidos_loja', 'wallet_transactions',
  'points_transactions', 'experience_transactions', 'trail_checkout_benefits',
  'content_documents', 'profiles', 'asaas_webhook_events',
  'asaas_payments', 'infinitepay_checkouts', 'audit_logs', 'backup_runs',
  'backup_restore_tests', 'dependent_registration_invites',
] as const;

const OPTIONAL_TABLES = new Set([
  'global_stats', 'trilha_custos', 'notificacoes', 'coupon_redemptions',
  'bolao_apostas', 'settings', 'trilha_gpx', 'fotos_trilhas',
  'infinitepay_checkouts',
]);

const MEDIA_PREFIXES = ['legacy-media/', 'media/', 'trilhas/', 'produtos/', 'cadastro-docs/', 'signatures/', 'app-profiles/'];

export async function runServerBackup(triggeredBy: string) {
  const supabase = createSupabaseAdmin();
  const startedAt = new Date();
  const backupId = crypto.randomUUID();
  const backupBucket = requireServerEnv('AWS_BACKUP_BUCKET_NAME');
  if (backupBucket === BUCKET_NAME) {
    throw new Error('AWS_BACKUP_BUCKET_NAME deve ser um bucket separado do bucket de mídia');
  }
  const datePrefix = startedAt.toISOString().replace(/[:.]/g, '-');
  const keyPrefix = `backups/${startedAt.getUTCFullYear()}/${String(startedAt.getUTCMonth() + 1).padStart(2, '0')}`;
  const databaseKey = `${keyPrefix}/${datePrefix}_${backupId}_supabase.json.gz`;
  const manifestKey = `${keyPrefix}/${datePrefix}_${backupId}_manifest.json`;

  await supabase.from('backup_runs').insert({ id: backupId, status: 'running', started_at: startedAt.toISOString() });

  try {
    const tables: Record<string, unknown[]> = {};
    const warnings: string[] = [];

    for (const table of BACKUP_TABLES) {
      try {
        tables[table] = await exportTable(supabase, table);
      } catch (error: any) {
        if (!OPTIONAL_TABLES.has(table)) throw error;
        warnings.push(`${table}: ${error.message || String(error)}`);
      }
    }

    const authUsers = await exportAuthUsers(supabase);

    const databasePayload = {
      format: 'maistrilha-supabase-backup-v1',
      backupId,
      exportedAt: new Date().toISOString(),
      triggeredBy,
      warnings,
      tables,
      authUsers,
    };
    const compressed = gzipSync(Buffer.from(JSON.stringify(databasePayload)));
    const checksum = createHash('sha256').update(compressed).digest('hex');

    await s3Client.send(new PutObjectCommand({
      Bucket: backupBucket,
      Key: databaseKey,
      Body: compressed,
      ContentType: 'application/json',
      ContentEncoding: 'gzip',
      ServerSideEncryption: 'AES256',
      Metadata: { backupId, checksumSha256: checksum },
    }));

    const mediaObjects = await listMediaObjects();
    const mediaMirror = await mirrorMediaObjects(mediaObjects, backupBucket, warnings);
    const manifest = {
      format: 'maistrilha-server-manifest-v1',
      backupId,
      createdAt: new Date().toISOString(),
      database: { bucket: backupBucket, key: databaseKey, size: compressed.length, checksumSha256: checksum },
      media: {
        sourceBucket: BUCKET_NAME,
        mirrorBucket: backupBucket,
        mirrorPrefix: 'media-mirror/',
        objectCount: mediaObjects.length,
        copied: mediaMirror.copied,
        unchanged: mediaMirror.unchanged,
        objects: mediaObjects,
      },
      warnings,
    };
    const manifestBody = Buffer.from(JSON.stringify(manifest, null, 2));
    const manifestChecksum = createHash('sha256').update(manifestBody).digest('hex');

    await s3Client.send(new PutObjectCommand({
      Bucket: backupBucket,
      Key: manifestKey,
      Body: manifestBody,
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
      Metadata: { backupId, checksumSha256: manifestChecksum },
    }));

    const [databaseHead, manifestHead] = await Promise.all([
      s3Client.send(new HeadObjectCommand({ Bucket: backupBucket, Key: databaseKey })),
      s3Client.send(new HeadObjectCommand({ Bucket: backupBucket, Key: manifestKey })),
    ]);
    if (
      databaseHead.ContentLength !== compressed.length ||
      databaseHead.Metadata?.checksumsha256 !== checksum ||
      manifestHead.ContentLength !== manifestBody.length ||
      manifestHead.Metadata?.checksumsha256 !== manifestChecksum
    ) {
      throw new Error('Falha na verificação de integridade dos objetos gravados no backup');
    }

    await supabase.from('backup_runs').update({
      status: 'completed',
      database_key: databaseKey,
      manifest_key: manifestKey,
      size_bytes: compressed.length,
      checksum_sha256: checksum,
      manifest_checksum_sha256: manifestChecksum,
      warnings,
      table_count: Object.keys(tables).length,
      auth_user_count: authUsers.length,
      media_object_count: mediaObjects.length,
      media_copied_count: mediaMirror.copied,
      completed_at: new Date().toISOString(),
    }).eq('id', backupId);

    return {
      backupId, databaseKey, manifestKey, sizeBytes: compressed.length,
      mediaObjects: mediaObjects.length, mediaCopied: mediaMirror.copied,
      mediaUnchanged: mediaMirror.unchanged, warnings,
    };
  } catch (error: any) {
    await supabase.from('backup_runs').update({
      status: 'failed',
      error_message: String(error.message || error).slice(0, 2000),
      completed_at: new Date().toISOString(),
    }).eq('id', backupId);
    throw error;
  }
}

async function exportTable(supabase: ReturnType<typeof createSupabaseAdmin>, table: string) {
  const rows: unknown[] = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase.from(table).select('*').range(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function exportAuthUsers(supabase: ReturnType<typeof createSupabaseAdmin>) {
  const users: unknown[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users.map((user) => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_sign_in_at: user.last_sign_in_at,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    })));
    if (data.users.length < perPage) break;
  }
  return users;
}

async function listMediaObjects() {
  const objects: Array<{ key: string; size: number; lastModified?: string; etag?: string }> = [];

  for (const prefix of MEDIA_PREFIXES) {
    let continuationToken: string | undefined;
    do {
      const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));
      for (const item of response.Contents || []) {
        if (!item.Key) continue;
        objects.push({
          key: item.Key,
          size: item.Size || 0,
          lastModified: item.LastModified?.toISOString(),
          etag: item.ETag,
        });
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
  }

  return objects;
}

async function mirrorMediaObjects(
  objects: Array<{ key: string; size: number; lastModified?: string; etag?: string }>,
  backupBucket: string,
  warnings: string[],
) {
  try {
    await s3Client.send(new PutBucketVersioningCommand({
      Bucket: backupBucket,
      VersioningConfiguration: { Status: 'Enabled' },
    }));
  } catch (error: any) {
    warnings.push(`versionamento do bucket de backup: ${error.message || String(error)}`);
  }

  let copied = 0;
  let unchanged = 0;
  let cursor = 0;
  const workers = Array.from({ length: 5 }, async () => {
    while (cursor < objects.length) {
      const object = objects[cursor++];
      const destinationKey = `media-mirror/${object.key}`;
      const sourceEtag = String(object.etag || '').replaceAll('"', '');
      try {
        const current = await s3Client.send(new HeadObjectCommand({ Bucket: backupBucket, Key: destinationKey }));
        if (current.Metadata?.sourceetag === sourceEtag && current.ContentLength === object.size) {
          unchanged++;
          continue;
        }
      } catch (error: any) {
        if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound') throw error;
      }
      const copySource = encodeURIComponent(`${BUCKET_NAME}/${object.key}`).replaceAll('%2F', '/');
      await s3Client.send(new CopyObjectCommand({
        Bucket: backupBucket,
        Key: destinationKey,
        CopySource: copySource,
        MetadataDirective: 'REPLACE',
        Metadata: { sourceetag: sourceEtag },
        ServerSideEncryption: 'AES256',
        CacheControl: 'private, max-age=31536000, immutable',
      }));
      copied++;
    }
  });
  await Promise.all(workers);
  return { copied, unchanged };
}
