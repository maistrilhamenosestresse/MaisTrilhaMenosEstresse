import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { gzipSync } from "node:zlib";
import {
  CopyObjectCommand,
  HeadObjectCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

await loadEnv(path.join(process.cwd(), ".env.local"));

const applyChanges = process.argv.includes("--apply");
const migrationId = randomUUID();
const startedAt = new Date();
const currentSupabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const currentProjectRef = new URL(currentSupabaseUrl).hostname.split(".")[0];
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const databaseUrl = required("DATABASE_URL");
const mediaBucket = required("AWS_S3_BUCKET_NAME");
const backupBucket = required("AWS_BACKUP_BUCKET_NAME");
const region = process.env.AWS_REGION || "us-east-1";
const mediaHost = `${mediaBucket}.s3.${region}.amazonaws.com`;
const backupPrefix = `supabase-migration/${startedAt.toISOString().slice(0, 10)}/${migrationId}`;
const tempRoot = path.join(process.cwd(), "tmp", "supabase-migration", migrationId);

if (mediaBucket === backupBucket) {
  throw new Error("AWS_BACKUP_BUCKET_NAME deve ser diferente de AWS_S3_BUCKET_NAME");
}

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: required("AWS_ACCESS_KEY_ID"),
    secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
  },
});
const supabase = createClient(currentSupabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await db.connect();
try {
  const initialState = await collectActiveMediaState(db);
  const storageObjects = await listAllCurrentStorageObjects();
  const supabaseReferences = collectSupabaseReferences(initialState);
  const audit = {
    currentProjectRef,
    currentStorageObjects: storageObjects.length,
    activeSupabaseReferences: supabaseReferences.length,
    uniqueActiveSupabaseReferences: new Set(supabaseReferences.map((item) => item.value)).size,
    referenceHosts: countBy(supabaseReferences, (item) => new URL(item.value).hostname),
    activeAwsReferences: collectAllUrls(initialState).filter((value) => isAwsMediaUrl(value)).length,
  };

  process.stdout.write(`${JSON.stringify({ mode: applyChanges ? "apply" : "dry-run", audit }, null, 2)}\n`);
  if (!applyChanges) {
    process.stdout.write("Simulação concluída. Use --apply para fazer backup, copiar arquivos e atualizar os links.\n");
    process.exitCode = 0;
  } else {
    await mkdir(tempRoot, { recursive: true });
    const result = await runMigration({ initialState, storageObjects, supabaseReferences, audit });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
} finally {
  await db.end().catch(() => undefined);
  s3.destroy();
  await safeRemoveTemp();
}

async function runMigration({ initialState, storageObjects, supabaseReferences, audit }) {
  await ensureBackupBucketVersioning();
  process.stdout.write("1/6 Criando backup lógico completo dos schemas public, auth, storage e supabase_migrations...\n");
  const databaseBackup = await backupDatabase();

  process.stdout.write(`2/6 Copiando ${storageObjects.length} objeto(s) do Supabase Storage atual...\n`);
  const archivedObjects = new Map();
  const archivedDetails = [];
  let storageIndex = 0;
  for (const object of storageObjects) {
    storageIndex += 1;
    const source = {
      projectRef: currentProjectRef,
      bucket: object.bucket,
      objectPath: object.path,
      sourceKind: "current-storage",
      fetchUrl: await createCurrentStorageSignedUrl(object.bucket, object.path),
      fallbackContentType: object.contentType,
    };
    const archived = await archiveSourceObject(source);
    archivedObjects.set(objectIdentity(source), archived);
    archivedDetails.push(archivedManifestEntry(source, archived));
    progress("Supabase Storage", storageIndex, storageObjects.length);
  }

  process.stdout.write("3/6 Copiando mídias legadas ainda referenciadas pelo banco...\n");
  const replacements = new Map();
  const uniqueReferences = [...new Set(supabaseReferences.map((item) => item.value))];
  let referenceIndex = 0;
  for (const sourceUrl of uniqueReferences) {
    referenceIndex += 1;
    const parsed = parseSupabaseStorageUrl(sourceUrl);
    if (!parsed) throw new Error("URL Supabase inválida encontrada em uma coluna ativa");

    let archived = archivedObjects.get(objectIdentity(parsed));
    if (!archived) {
      const source = {
        ...parsed,
        sourceKind: parsed.projectRef === currentProjectRef ? "current-reference" : "legacy-public-reference",
        fetchUrl: parsed.projectRef === currentProjectRef
          ? await createCurrentStorageSignedUrl(parsed.bucket, parsed.objectPath)
          : sourceUrl,
      };
      archived = await archiveSourceObject(source);
      archivedObjects.set(objectIdentity(source), archived);
      archivedDetails.push(archivedManifestEntry(source, archived));
    }
    replacements.set(sourceUrl, archived.mediaUrl);
    progress("Referências legadas", referenceIndex, uniqueReferences.length);
  }

  const prelinkManifest = {
    format: "maistrilha-supabase-media-migration-v2",
    migrationId,
    phase: "files-backed-up-before-relink",
    createdAt: new Date().toISOString(),
    currentProjectRef,
    databaseBackup,
    audit,
    archivedObjects: archivedDetails,
    replacementCount: replacements.size,
  };
  const detailedManifestKey = `${backupPrefix}/detailed-manifest.json`;
  await putJsonVerified(backupBucket, detailedManifestKey, prelinkManifest);

  process.stdout.write("4/6 Atualizando os links ativos em uma transação no banco...\n");
  const updateCounts = await applyDatabaseReplacements(initialState, replacements, {
    detailedManifestKey,
    databaseBackup,
    archivedObjectCount: archivedDetails.length,
  });

  process.stdout.write("5/6 Validando banco e objetos AWS após a atualização...\n");
  const finalState = await collectActiveMediaState(db);
  const remaining = collectSupabaseReferences(finalState);
  if (remaining.length) {
    throw new Error(`${remaining.length} referência(s) ativa(s) ainda apontam para Supabase Storage`);
  }
  const awsUrls = [...new Set(collectAllUrls(finalState).filter(isAwsMediaUrl))];
  for (let index = 0; index < awsUrls.length; index += 1) {
    await verifyMediaUrlHead(awsUrls[index]);
    progress("Validação AWS", index + 1, awsUrls.length);
  }

  process.stdout.write("6/6 Gravando manifestos finais e trilha de auditoria...\n");
  const completedAt = new Date().toISOString();
  const publicSummary = {
    format: "maistrilha-supabase-media-migration-summary-v2",
    migrationId,
    completedAt,
    currentProjectRef,
    destinationBucket: mediaBucket,
    databaseBackupKey: databaseBackup.key,
    detailedManifestBucket: backupBucket,
    detailedManifestKey,
    currentStorageObjectsCopied: storageObjects.length,
    legacyReferencesMigrated: replacements.size,
    archivedObjectCount: archivedDetails.length,
    updateCounts,
    remainingSupabaseMediaReferences: 0,
    verifiedAwsUrls: awsUrls.length,
  };
  const summaryKey = "migration-manifests/supabase-to-aws/latest.json";
  await Promise.all([
    putJsonVerified(mediaBucket, summaryKey, publicSummary),
    putJsonVerified(backupBucket, `${backupPrefix}/final-summary.json`, publicSummary),
  ]);
  await upsertMigrationSummary(publicSummary);

  return {
    success: true,
    migrationId,
    databaseBackup,
    detailedManifestKey,
    summaryKey,
    ...publicSummary,
  };
}

async function backupDatabase() {
  const backupFile = path.join(tempRoot, `${migrationId}.json.gz`);
  const schemaNames = ["public", "auth", "storage", "supabase_migrations"];
  const tableList = await db.query(
    `select table_schema, table_name
       from information_schema.tables
      where table_type='BASE TABLE'
        and table_schema = any($1::text[])
      order by table_schema, table_name`,
    [schemaNames],
  );
  const schemas = {};
  const warnings = [];
  let exportedTables = 0;
  for (const table of tableList.rows) {
    const schemaName = String(table.table_schema);
    const tableName = String(table.table_name);
    schemas[schemaName] ||= {};
    try {
      const result = await db.query(
        `select * from ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`,
      );
      schemas[schemaName][tableName] = result.rows;
      exportedTables += 1;
      if (exportedTables === 1 || exportedTables % 10 === 0 || exportedTables === tableList.rows.length) {
        process.stdout.write(`Backup lógico: ${exportedTables}/${tableList.rows.length} tabela(s)\n`);
      }
    } catch (error) {
      warnings.push(`${schemaName}.${tableName}: ${String(error?.message || error).slice(0, 500)}`);
    }
  }

  const columns = await db.query(
      `select table_schema, table_name, column_name, ordinal_position, column_default,
              is_nullable, data_type, udt_schema, udt_name
         from information_schema.columns
        where table_schema = any($1::text[])
        order by table_schema, table_name, ordinal_position`,
      [schemaNames],
    );
  const constraints = await db.query(
      `select tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type,
              kcu.column_name, ccu.table_schema as foreign_table_schema,
              ccu.table_name as foreign_table_name, ccu.column_name as foreign_column_name
         from information_schema.table_constraints tc
         left join information_schema.key_column_usage kcu
           on tc.constraint_catalog=kcu.constraint_catalog
          and tc.constraint_schema=kcu.constraint_schema
          and tc.constraint_name=kcu.constraint_name
         left join information_schema.constraint_column_usage ccu
           on tc.constraint_catalog=ccu.constraint_catalog
          and tc.constraint_schema=ccu.constraint_schema
          and tc.constraint_name=ccu.constraint_name
        where tc.table_schema = any($1::text[])
        order by tc.table_schema, tc.table_name, tc.constraint_name`,
      [schemaNames],
    );
  const policies = await db.query(
      `select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
         from pg_policies
        where schemaname = any($1::text[])
        order by schemaname, tablename, policyname`,
      [schemaNames],
    );
  const functions = await db.query(
      `select n.nspname as schema_name, p.proname as function_name,
              pg_get_function_identity_arguments(p.oid) as identity_arguments,
              pg_get_functiondef(p.oid) as definition
         from pg_proc p
         join pg_namespace n on n.oid=p.pronamespace
        where n.nspname = any($1::text[])
          and p.prokind in ('f','p')
        order by n.nspname, p.proname`,
      [schemaNames],
    );
  const payload = {
    format: "maistrilha-supabase-logical-backup-v2",
    migrationId,
    projectRef: currentProjectRef,
    exportedAt: new Date().toISOString(),
    schemas,
    catalog: {
      columns: columns.rows,
      constraints: constraints.rows,
      policies: policies.rows,
      functions: functions.rows,
    },
    warnings,
  };
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload)));
  await writeFile(backupFile, compressed, { flag: "wx" });
  const checksumSha256 = createHash("sha256").update(compressed).digest("hex");
  const key = `${backupPrefix}/database/supabase-logical-full.json.gz`;
  await putFileVerified(backupBucket, key, backupFile, {
    contentType: "application/json",
    contentEncoding: "gzip",
    checksumSha256,
    metadata: { migrationid: migrationId, backuptype: "logical-v2" },
  });
  return {
    bucket: backupBucket,
    key,
    size: compressed.length,
    checksumSha256,
    tableCount: tableList.rowCount || 0,
    rowCounts: Object.fromEntries(
      Object.entries(schemas).flatMap(([schemaName, tables]) =>
        Object.entries(tables).map(([tableName, rows]) => [
          `${schemaName}.${tableName}`,
          rows.length,
        ]),
      ),
    ),
    warnings,
  };
}

async function archiveSourceObject(source) {
  const sourceHash = sha256Text(objectIdentity(source));
  const tempFile = path.join(tempRoot, `${sourceHash}.bin`);
  const download = await downloadToFile(source.fetchUrl, tempFile, source.fallbackContentType);
  const extension = extensionFor(download.contentType, source.objectPath);
  const backupKey = `${backupPrefix}/supabase-storage/${source.projectRef}/${safeSegment(source.bucket)}/${download.checksumSha256}.${extension}`;
  const mediaKey = `supabase-migrated/${source.projectRef}/${safeSegment(source.bucket)}/${download.checksumSha256}.${extension}`;

  await putFileVerified(backupBucket, backupKey, tempFile, {
    contentType: download.contentType,
    checksumSha256: download.checksumSha256,
    metadata: {
      migrationid: migrationId,
      sourceproject: source.projectRef.slice(0, 100),
      sourcehash: sourceHash,
    },
  });
  await copyBackupObjectToMedia({
    backupKey,
    mediaKey,
    size: download.size,
    contentType: download.contentType,
    checksumSha256: download.checksumSha256,
    sourceProject: source.projectRef,
    sourceHash,
  });
  await rm(tempFile, { force: true });

  return {
    backupKey,
    mediaKey,
    mediaUrl: s3PublicUrl(mediaKey),
    size: download.size,
    contentType: download.contentType,
    checksumSha256: download.checksumSha256,
  };
}

async function downloadToFile(url, target, fallbackContentType) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar mídia de origem: HTTP ${response.status}`);
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  const maxBytes = 1024 * 1024 * 1024;
  if (declaredLength > maxBytes) {
    await response.body.cancel();
    throw new Error("Arquivo de origem excede o limite de segurança de 1 GB");
  }

  const hash = createHash("sha256");
  let size = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      if (size > maxBytes) {
        callback(new Error("Arquivo de origem excede o limite de segurança de 1 GB"));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(target, { flags: "wx" }));
  if (!size || (declaredLength && size !== declaredLength)) {
    throw new Error("Tamanho baixado não confere com a origem");
  }
  return {
    size,
    checksumSha256: hash.digest("hex"),
    contentType: normalizeContentType(
      response.headers.get("content-type") || fallbackContentType,
      new URL(url).pathname,
    ),
  };
}

async function putFileVerified(bucket, key, file, options) {
  const info = await stat(file);
  const existing = await headOrNull(bucket, key);
  if (
    existing &&
    existing.ContentLength === info.size &&
    existing.Metadata?.checksumsha256 === options.checksumSha256
  ) {
    return;
  }
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(file),
    ContentLength: info.size,
    ContentType: options.contentType,
    ContentEncoding: options.contentEncoding,
    CacheControl: bucket === backupBucket
      ? "private, max-age=31536000, immutable"
      : "public, max-age=31536000, immutable",
    ServerSideEncryption: "AES256",
    Metadata: {
      ...options.metadata,
      checksumsha256: options.checksumSha256,
    },
  }));
  const written = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (
    written.ContentLength !== info.size ||
    written.Metadata?.checksumsha256 !== options.checksumSha256
  ) {
    throw new Error(`Verificação AWS falhou após gravar ${key}`);
  }
}

async function copyBackupObjectToMedia({
  backupKey,
  mediaKey,
  size,
  contentType,
  checksumSha256,
  sourceProject,
  sourceHash,
}) {
  const existing = await headOrNull(mediaBucket, mediaKey);
  if (
    existing &&
    existing.ContentLength === size &&
    existing.Metadata?.checksumsha256 === checksumSha256
  ) {
    return;
  }
  await s3.send(new CopyObjectCommand({
    Bucket: mediaBucket,
    Key: mediaKey,
    CopySource: encodeCopySource(backupBucket, backupKey),
    MetadataDirective: "REPLACE",
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
    ServerSideEncryption: "AES256",
    Metadata: {
      migrationid: migrationId,
      sourceproject: sourceProject.slice(0, 100),
      sourcehash: sourceHash,
      checksumsha256: checksumSha256,
    },
  }));
  const written = await s3.send(new HeadObjectCommand({ Bucket: mediaBucket, Key: mediaKey }));
  if (
    written.ContentLength !== size ||
    written.Metadata?.checksumsha256 !== checksumSha256
  ) {
    throw new Error(`Verificação AWS falhou após copiar ${mediaKey}`);
  }
}

async function applyDatabaseReplacements(state, replacements, context) {
  const counts = {
    clients: 0,
    agendas: 0,
    produtos: 0,
    clientContracts: 0,
    trailPhotos: 0,
  };
  await db.query("BEGIN");
  try {
    for (const row of state.clients) {
      const photo = replaceUrl(row.photo_url, replacements);
      const signature = replaceUrl(row.signature_url, replacements);
      if (photo === row.photo_url && signature === row.signature_url) continue;
      await db.query(
        "update public.clients set photo_url=$1, signature_url=$2 where id=$3",
        [photo, signature, row.id],
      );
      counts.clients += 1;
    }
    for (const row of state.agendas) {
      const images = Array.isArray(row.images)
        ? row.images.map((value) => replaceUrl(value, replacements))
        : [];
      const video = replaceUrl(row.video_url, replacements);
      const flyer = replaceUrl(row.flyer_url, replacements);
      if (
        JSON.stringify(images) === JSON.stringify(row.images || []) &&
        video === row.video_url &&
        flyer === row.flyer_url
      ) continue;
      await db.query(
        "update public.agendas set images=$1::text[], video_url=$2, flyer_url=$3 where id=$4",
        [images, video, flyer, row.id],
      );
      counts.agendas += 1;
    }
    for (const row of state.produtos) {
      const image = replaceUrl(row.image, replacements);
      if (image === row.image) continue;
      await db.query("update public.produtos set image=$1 where id=$2", [image, row.id]);
      counts.produtos += 1;
    }
    for (const row of state.clientContracts) {
      const signature = replaceUrl(row.signature_url, replacements);
      if (signature === row.signature_url) continue;
      await db.query(
        "update public.client_contracts set signature_url=$1 where id=$2",
        [signature, row.id],
      );
      counts.clientContracts += 1;
    }
    for (const row of state.trailPhotos) {
      const awsUrl = replaceUrl(row.aws_url, replacements);
      if (awsUrl === row.aws_url) continue;
      await db.query(
        "update public.fotos_trilhas set aws_url=$1, aws_key=$2 where id=$3",
        [awsUrl, awsKeyFromUrl(awsUrl), row.id],
      );
      counts.trailPhotos += 1;
    }

    const summary = {
      format: "maistrilha-supabase-media-migration-db-link-v2",
      migrationId,
      updatedAt: new Date().toISOString(),
      destinationBucket: mediaBucket,
      detailedManifestBucket: backupBucket,
      detailedManifestKey: context.detailedManifestKey,
      databaseBackup: context.databaseBackup,
      archivedObjectCount: context.archivedObjectCount,
      replacementCount: replacements.size,
      updateCounts: counts,
    };
    await db.query(
      `insert into public.content_documents
        (document_key, title, structured_content, mime_type, published, version, updated_at)
       values ($1, $2, $3::jsonb, 'application/json', false, 2, now())
       on conflict (document_key) do update set
         title=excluded.title,
         structured_content=excluded.structured_content,
         mime_type=excluded.mime_type,
         published=false,
         version=excluded.version,
         updated_at=now()`,
      ["supabase-media-to-aws-migration", "Migração completa de mídias do Supabase para AWS", JSON.stringify(summary)],
    );
    await db.query(
      `insert into public.audit_logs
        (action, resource_type, resource_id, metadata)
       values ('media.supabase_to_aws', 'media_migration', $1, $2::jsonb)`,
      [migrationId, JSON.stringify({
        destinationBucket: mediaBucket,
        replacementCount: replacements.size,
        archivedObjectCount: context.archivedObjectCount,
        updateCounts: counts,
        detailedManifestKey: context.detailedManifestKey,
      })],
    );
    await db.query("COMMIT");
    return counts;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

async function upsertMigrationSummary(summary) {
  const { error } = await supabase.from("content_documents").upsert({
    document_key: "supabase-media-to-aws-migration",
    title: "Migração completa de mídias do Supabase para AWS",
    structured_content: summary,
    mime_type: "application/json",
    published: false,
    version: 2,
    updated_at: new Date().toISOString(),
  }, { onConflict: "document_key" });
  if (error) throw error;
}

async function collectActiveMediaState(client) {
  const clients = await queryRows(
    client,
    "select id::text, photo_url, signature_url from public.clients",
  );
  const agendas = await queryRows(
    client,
    "select id::text, images, video_url, flyer_url from public.agendas",
  );
  const produtos = await queryRows(
    client,
    "select id::text, image from public.produtos",
  );
  const clientContracts = await queryRows(
    client,
    "select id::text, signature_url from public.client_contracts",
  );
  const trailPhotos = await queryRows(
    client,
    "select id::text, aws_url, aws_key from public.fotos_trilhas",
  );
  return { clients, agendas, produtos, clientContracts, trailPhotos };
}

function collectAllUrls(state) {
  const values = [];
  for (const row of state.clients) values.push(row.photo_url, row.signature_url);
  for (const row of state.agendas) values.push(...(row.images || []), row.video_url, row.flyer_url);
  for (const row of state.produtos) values.push(row.image);
  for (const row of state.clientContracts) values.push(row.signature_url);
  for (const row of state.trailPhotos) values.push(row.aws_url);
  return values.filter((value) => typeof value === "string" && value.trim());
}

function collectSupabaseReferences(state) {
  const references = [];
  const add = (table, id, column, value) => {
    if (isSupabaseStorageUrl(value)) references.push({ table, id, column, value });
  };
  for (const row of state.clients) {
    add("clients", row.id, "photo_url", row.photo_url);
    add("clients", row.id, "signature_url", row.signature_url);
  }
  for (const row of state.agendas) {
    for (const value of row.images || []) add("agendas", row.id, "images", value);
    add("agendas", row.id, "video_url", row.video_url);
    add("agendas", row.id, "flyer_url", row.flyer_url);
  }
  for (const row of state.produtos) add("produtos", row.id, "image", row.image);
  for (const row of state.clientContracts) {
    add("client_contracts", row.id, "signature_url", row.signature_url);
  }
  for (const row of state.trailPhotos) add("fotos_trilhas", row.id, "aws_url", row.aws_url);
  return references;
}

async function listAllCurrentStorageObjects() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const objects = [];
  for (const bucket of buckets || []) {
    await walkStorageBucket(bucket.name, "", objects, 0);
  }
  return objects;
}

async function walkStorageBucket(bucket, prefix, output, depth) {
  if (depth > 12) throw new Error(`Profundidade excessiva no bucket ${bucket}`);
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const entries = data || [];
    for (const entry of entries) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!entry.id && !entry.metadata) {
        await walkStorageBucket(bucket, objectPath, output, depth + 1);
      } else {
        output.push({
          bucket,
          path: objectPath,
          size: Number(entry.metadata?.size || 0),
          contentType: String(entry.metadata?.mimetype || ""),
        });
      }
    }
    if (entries.length < 1000) break;
    offset += entries.length;
  }
}

async function createCurrentStorageSignedUrl(bucket, objectPath) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 600);
  if (error || !data?.signedUrl) throw error || new Error("Não foi possível assinar download do Storage");
  return data.signedUrl;
}

async function putJsonVerified(bucket, key, value) {
  const body = Buffer.from(JSON.stringify(value, null, 2));
  const checksumSha256 = createHash("sha256").update(body).digest("hex");
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentLength: body.length,
    ContentType: "application/json",
    CacheControl: bucket === backupBucket ? "private, no-store" : "public, max-age=300",
    ServerSideEncryption: "AES256",
    Metadata: { migrationid: migrationId, checksumsha256: checksumSha256 },
  }));
  const written = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (
    written.ContentLength !== body.length ||
    written.Metadata?.checksumsha256 !== checksumSha256
  ) {
    throw new Error(`Manifesto não passou na verificação: ${key}`);
  }
}

async function verifyMediaUrlHead(value) {
  const url = new URL(value);
  if (url.hostname !== mediaHost) throw new Error(`Host de mídia inesperado: ${url.hostname}`);
  const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const object = await s3.send(new HeadObjectCommand({ Bucket: mediaBucket, Key: key }));
  if (!object.ContentLength || object.ContentLength <= 0) {
    throw new Error(`Objeto AWS vazio: ${key}`);
  }
}

async function ensureBackupBucketVersioning() {
  await s3.send(new PutBucketVersioningCommand({
    Bucket: backupBucket,
    VersioningConfiguration: { Status: "Enabled" },
  }));
}

async function headOrNull(bucket, key) {
  try {
    return await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") return null;
    throw error;
  }
}

function parseSupabaseStorageUrl(value) {
  if (!isSupabaseStorageUrl(value)) return null;
  const url = new URL(value);
  const parts = url.pathname.split("/").filter(Boolean);
  const objectIndex = parts.findIndex((part) => part === "object");
  if (objectIndex < 0) return null;
  const visibilityIndex = objectIndex + 1;
  const bucketIndex = visibilityIndex + 1;
  const bucket = parts[bucketIndex];
  const objectPath = parts.slice(bucketIndex + 1).map(decodeURIComponent).join("/");
  if (!bucket || !objectPath) return null;
  return {
    projectRef: url.hostname.split(".")[0],
    bucket,
    objectPath,
  };
}

function isSupabaseStorageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.hostname.endsWith(".supabase.co") &&
      url.pathname.includes("/storage/v1/object/");
  } catch {
    return false;
  }
}

function isAwsMediaUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    return new URL(value).hostname === mediaHost;
  } catch {
    return false;
  }
}

function replaceUrl(value, replacements) {
  if (typeof value !== "string" || !value) return value || null;
  return replacements.get(value) || value;
}

function objectIdentity(source) {
  return `${source.projectRef}/${source.bucket}/${source.objectPath}`;
}

function archivedManifestEntry(source, archived) {
  return {
    sourceProjectRef: source.projectRef,
    sourceBucket: source.bucket,
    sourceObjectPath: source.objectPath,
    sourceKind: source.sourceKind,
    backupKey: archived.backupKey,
    mediaKey: archived.mediaKey,
    size: archived.size,
    contentType: archived.contentType,
    checksumSha256: archived.checksumSha256,
  };
}

function s3PublicUrl(key) {
  return `https://${mediaHost}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function awsKeyFromUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.hostname !== mediaHost) return null;
  return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
}

function encodeCopySource(bucket, key) {
  return encodeURIComponent(`${bucket}/${key}`).replaceAll("%2F", "/");
}

function normalizeContentType(value, pathname) {
  const type = String(value || "").split(";")[0].trim().toLowerCase();
  const allowed = new Set([
    "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif",
    "video/mp4", "video/quicktime", "application/pdf",
  ]);
  if (allowed.has(type)) return type;
  const extension = path.extname(pathname).toLowerCase();
  return ({
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".avif": "image/avif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".pdf": "application/pdf",
  })[extension] || "application/octet-stream";
}

function extensionFor(contentType, pathname) {
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "application/pdf": "pdf",
  })[contentType] || safeExtension(pathname) || "bin";
}

function safeExtension(value) {
  const extension = path.extname(String(value || "")).replace(/^\./, "").toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(extension) ? extension : "";
}

function safeSegment(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function countBy(values, selector) {
  const result = {};
  for (const value of values) {
    const key = selector(value);
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

async function queryRows(client, sql) {
  try {
    return (await client.query(sql)).rows;
  } catch (error) {
    if (error?.code === "42P01") return [];
    throw error;
  }
}

function progress(label, current, total) {
  if (current === total || current === 1 || current % 10 === 0) {
    process.stdout.write(`${label}: ${current}/${total}\n`);
  }
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function safeRemoveTemp() {
  const workspaceTmp = path.resolve(process.cwd(), "tmp");
  const resolved = path.resolve(tempRoot);
  if (!resolved.startsWith(`${workspaceTmp}${path.sep}`)) {
    throw new Error("Diretório temporário fora do workspace");
  }
  await rm(resolved, { recursive: true, force: true });
}

async function loadEnv(file) {
  const content = await readFile(file, "utf8");
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

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
