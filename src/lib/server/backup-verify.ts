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
  "experience_transactions",
  "trail_checkout_benefits",
  "content_documents",
  "client_contracts",
  "contract_signing_invites",
  "loyalty_program_config",
  "loyalty_award_decisions",
  "loyalty_balance_snapshots",
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
      criticalEvidence?: {
        contracts?: { count?: number; digestSha256?: string };
      };
    };
    const manifest = JSON.parse(Buffer.from(manifestBytes).toString("utf8")) as {
      format?: string;
      backupId?: string;
      media?: { objects?: Array<{ key?: string }> };
      criticalEvidence?: {
        contracts?: { count?: number; digestSha256?: string };
      };
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

    const contracts = payload.tables?.client_contracts || [];
    const calculatedContractEvidence = buildContractEvidence(contracts);
    const payloadContractEvidence = payload.criticalEvidence?.contracts;
    const manifestContractEvidence = manifest.criticalEvidence?.contracts;
    if (
      contracts.some((value) => {
        const contract = value as Record<string, unknown>;
        return !String(contract.document_hash || "").trim()
          || !String(contract.signature_url || "").trim()
          || !contract.document_snapshot;
      })
      || payloadContractEvidence?.count !== calculatedContractEvidence.count
      || payloadContractEvidence?.digestSha256 !== calculatedContractEvidence.digestSha256
      || manifestContractEvidence?.count !== calculatedContractEvidence.count
      || manifestContractEvidence?.digestSha256 !== calculatedContractEvidence.digestSha256
    ) {
      throw new Error("Evidência dos contratos ausente ou divergente no backup");
    }

    const mediaObjects = Array.isArray(manifest.media?.objects)
      ? manifest.media.objects.filter((item) => item?.key)
      : [];
    const mediaKeys = new Set(mediaObjects.map((item) => item.key));
    const contractSignatureKeys = contracts
      .map((value) =>
        signatureKey((value as Record<string, unknown>).signature_url),
      )
      .filter((key): key is string => Boolean(key));
    if (contractSignatureKeys.some((key) => !mediaKeys.has(key))) {
      throw new Error("Assinatura de contrato ausente no manifesto de mídia");
    }

    const sample = selectMediaSample(mediaObjects, 25);
    const signatureSample = selectMediaSample(
      [...new Set(contractSignatureKeys)].map((key) => ({ key })),
      100,
    );
    const verificationKeys = [...new Set([
      ...sample.map((item) => item.key),
      ...signatureSample.map((item) => item.key),
    ].filter((key): key is string => Boolean(key)))];
    await Promise.all(verificationKeys.map((key) =>
      s3Client.send(new HeadObjectCommand({
        Bucket: backupBucket,
        Key: `media-mirror/${key}`,
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
        media_objects_verified: verificationKeys.length,
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
          mediaObjectsSampled: verificationKeys.length,
          contractsVerified: calculatedContractEvidence.count,
        },
      }),
    ]);

    return {
      backupId: run.id,
      databaseChecksumValid: true,
      manifestChecksumValid: true,
      tablesVerified: REQUIRED_TABLES.length,
      authUsersVerified: payload.authUsers.length,
      mediaObjectsVerified: verificationKeys.length,
      contractsVerified: calculatedContractEvidence.count,
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

function buildContractEvidence(rows: unknown[]) {
  const normalized = rows
    .map((value) => {
      const row = value as Record<string, unknown>;
      return [
        row.id,
        row.client_id,
        row.contract_type,
        row.version,
        row.document_hash,
        row.signature_url,
        row.signed_at,
      ].map((item) => String(item || "")).join("|");
    })
    .sort();
  return {
    count: normalized.length,
    digestSha256: createHash("sha256")
      .update(normalized.join("\n"))
      .digest("hex"),
  };
}

function signatureKey(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    return key.startsWith("signatures/") ? key : null;
  } catch {
    return null;
  }
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
