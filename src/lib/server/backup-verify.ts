import "server-only";

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/aws";
import { requireServerEnv } from "@/lib/server/env";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

const REQUIRED_TABLES = [
  "agendas",
  "clients",
  "reservas",
  "produtos",
  "pedidos_loja",
  "wallet_transactions",
  "points_transactions",
  "content_documents",
  "profiles",
  "asaas_webhook_events",
  "asaas_payments",
  "audit_logs",
  "backup_runs",
] as const;

export async function verifyLatestServerBackup(triggeredBy: string) {
  const supabase = createSupabaseAdmin();
  const backupBucket = requireServerEnv("AWS_BACKUP_BUCKET_NAME");
  const { data: run, error: runError } = await supabase
    .from("backup_runs")
    .select("id, database_key, manifest_key, checksum_sha256, manifest_checksum_sha256")
    .eq("status", "completed")
    .not("database_key", "is", null)
    .not("manifest_key", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError || !run) throw runError || new Error("Nenhum backup concluído para verificar");

  const { data: test, error: testError } = await supabase
    .from("backup_restore_tests")
    .insert({ backup_run_id: run.id, status: "running" })
    .select("id")
    .single();
  if (testError) throw testError;

  try {
    const [databaseObject, manifestObject] = await Promise.all([
      s3Client.send(new GetObjectCommand({ Bucket: backupBucket, Key: run.database_key })),
      s3Client.send(new GetObjectCommand({ Bucket: backupBucket, Key: run.manifest_key })),
    ]);
    if (!databaseObject.Body || !manifestObject.Body) {
      throw new Error("Objetos do backup sem conteúdo");
    }

    const [databaseBytes, manifestBytes] = await Promise.all([
      databaseObject.Body.transformToByteArray(),
      manifestObject.Body.transformToByteArray(),
    ]);
    const databaseChecksum = sha256(databaseBytes);
    const manifestChecksum = sha256(manifestBytes);
    const databaseChecksumValid = databaseChecksum === run.checksum_sha256;
    const manifestChecksumValid = manifestChecksum === run.manifest_checksum_sha256;
    if (!databaseChecksumValid || !manifestChecksumValid) {
      throw new Error("Checksum do backup não confere com o registro do banco");
    }

    const payload = JSON.parse(
      gunzipSync(Buffer.from(databaseBytes)).toString("utf8"),
    ) as {
      format?: string;
      backupId?: string;
      tables?: Record<string, unknown[]>;
      authUsers?: unknown[];
    };
    const manifest = JSON.parse(Buffer.from(manifestBytes).toString("utf8")) as {
      format?: string;
      backupId?: string;
      media?: { objects?: Array<{ key?: string }> };
    };
    if (
      payload.format !== "maistrilha-supabase-backup-v1" ||
      manifest.format !== "maistrilha-server-manifest-v1" ||
      payload.backupId !== run.id ||
      manifest.backupId !== run.id
    ) {
      throw new Error("Formato ou identificador do backup inválido");
    }

    for (const table of REQUIRED_TABLES) {
      if (!Array.isArray(payload.tables?.[table])) {
        throw new Error(`Tabela crítica ausente no backup: ${table}`);
      }
    }
    if (!Array.isArray(payload.authUsers)) {
      throw new Error("Usuários do Supabase Auth ausentes no backup");
    }

    const mediaObjects = Array.isArray(manifest.media?.objects)
      ? manifest.media.objects.filter((item) => item?.key)
      : [];
    const sample = selectMediaSample(mediaObjects, 25);
    await Promise.all(sample.map((item) =>
      s3Client.send(new HeadObjectCommand({
        Bucket: backupBucket,
        Key: `media-mirror/${item.key}`,
      })),
    ));

    const completedAt = new Date().toISOString();
    await Promise.all([
      supabase.from("backup_restore_tests").update({
        status: "completed",
        database_checksum_valid: true,
        manifest_checksum_valid: true,
        tables_verified: REQUIRED_TABLES.length,
        auth_users_verified: payload.authUsers.length,
        media_objects_verified: sample.length,
        completed_at: completedAt,
      }).eq("id", test.id),
      supabase.from("backup_runs").update({
        integrity_verified_at: completedAt,
      }).eq("id", run.id),
      supabase.from("audit_logs").insert({
        action: "backup.restore_test",
        resource_type: "backup_run",
        resource_id: run.id,
        metadata: {
          triggeredBy,
          tablesVerified: REQUIRED_TABLES.length,
          authUsersVerified: payload.authUsers.length,
          mediaObjectsSampled: sample.length,
        },
      }),
    ]);

    return {
      backupId: run.id,
      databaseChecksumValid: true,
      manifestChecksumValid: true,
      tablesVerified: REQUIRED_TABLES.length,
      authUsersVerified: payload.authUsers.length,
      mediaObjectsVerified: sample.length,
    };
  } catch (error: any) {
    await supabase.from("backup_restore_tests").update({
      status: "failed",
      error_message: String(error.message || error).slice(0, 2000),
      completed_at: new Date().toISOString(),
    }).eq("id", test.id);
    throw error;
  }
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function selectMediaSample(objects: Array<{ key?: string }>, limit: number) {
  if (objects.length <= limit) return objects;
  const result: Array<{ key?: string }> = [];
  const step = (objects.length - 1) / (limit - 1);
  for (let index = 0; index < limit; index++) {
    result.push(objects[Math.round(index * step)]);
  }
  return result;
}
