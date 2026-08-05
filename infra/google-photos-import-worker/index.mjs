import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { CreateCollectionCommand, IndexFacesCommand, RekognitionClient } from "@aws-sdk/client-rekognition";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || "us-east-1";
const bucket = required("AWS_BUCKET_NAME");
const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
const supabaseKey = required("SUPABASE_SERVICE_ROLE_KEY");
const googleClientId = required("GOOGLE_PHOTOS_CLIENT_ID");
const googleClientSecret = required("GOOGLE_PHOTOS_CLIENT_SECRET");
const encryptionKey = Buffer.from(required("GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY"), "base64url");
if (encryptionKey.length !== 32) throw new Error("GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY inválida");

const s3 = new S3Client({
  region,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const rekognition = new RekognitionClient({ region });

export async function handler(event) {
  const failures = [];
  for (const record of event.Records || []) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error("Falha na importação Google Fotos", { messageId: record.messageId, message: String(error?.message || error) });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
}

async function processRecord(record) {
  const message = JSON.parse(record.body || "{}");
  const itemId = String(message.itemId || "");
  if (!isUuid(itemId)) throw new Error("Item inválido na fila");
  const receiveCount = Number(record.attributes?.ApproximateReceiveCount || 1);

  const item = await getOne("google_photos_import_items", `id=eq.${encodeURIComponent(itemId)}`);
  if (!item || item.status === "completed") return;
  const job = await getOne("google_photos_import_jobs", `id=eq.${encodeURIComponent(item.job_id)}`);
  if (!job || ["cancelled", "expired"].includes(job.status)) return;

  await patchRows("google_photos_import_items", `id=eq.${encodeURIComponent(itemId)}`, {
    status: "processing",
    attempt_count: Number(item.attempt_count || 0) + 1,
    error_message: null,
    updated_at: new Date().toISOString(),
  });
  await patchRows("google_photos_import_jobs", `id=eq.${encodeURIComponent(job.id)}`, {
    status: "processing",
    updated_at: new Date().toISOString(),
  });

  try {
    const accessToken = await validAccessToken(job);
    let freshItem = await refreshBaseUrlIfNeeded(item, job, accessToken);
    const mimeType = String(freshItem.mime_type || "").toLowerCase();
    const isVideo = mimeType.startsWith("video/");
    const objectPrefix = `trilhas/${job.agenda_id}/google/${job.id}`;
    const safeFilename = safeObjectName(freshItem.filename || freshItem.google_media_id);
    const originalKey = `${objectPrefix}/originais/${freshItem.id}-${safeFilename}`;
    let original;
    try {
      original = await googleDownload(`${freshItem.base_url}=${isVideo ? "dv" : "d"}`, accessToken);
    } catch (error) {
      if (error?.code !== "GOOGLE_MEDIA_URL_EXPIRED") throw error;
      freshItem = await refreshBaseUrlIfNeeded(freshItem, job, accessToken, true);
      original = await googleDownload(`${freshItem.base_url}=${isVideo ? "dv" : "d"}`, accessToken);
    }
    const originalType = original.headers.get("content-type")?.split(";")[0] || mimeType || "application/octet-stream";
    await putStream(originalKey, originalType, original.body, original.headers.get("content-length"));

    let displayKey = originalKey;
    let displayType = originalType;
    if (!isVideo && !["image/jpeg", "image/png"].includes(originalType)) {
      const derivative = await googleDownload(`${freshItem.base_url}=w16383-h16383`, accessToken);
      displayType = derivative.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      displayKey = `${objectPrefix}/exibicao/${freshItem.id}.jpg`;
      await putStream(displayKey, displayType, derivative.body, derivative.headers.get("content-length"));
    }

    const faceIds = isVideo ? [] : await indexFaces(job.agenda_id, displayKey, displayType);
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${displayKey}`;
    await rpc("finish_google_photos_import_item", {
      p_item_id: itemId,
      p_aws_key: displayKey,
      p_aws_url: publicUrl,
      p_face_ids: faceIds.join(","),
      p_original_aws_key: originalKey,
      p_original_mime_type: originalType,
      p_error_message: null,
    });
    await cleanupCompletedGoogleSession(job, accessToken);
  } catch (error) {
    const messageText = String(error?.message || error).slice(0, 900);
    if (receiveCount >= 3) {
      await rpc("finish_google_photos_import_item", {
        p_item_id: itemId,
        p_aws_key: null,
        p_aws_url: null,
        p_face_ids: null,
        p_original_aws_key: null,
        p_original_mime_type: null,
        p_error_message: messageText,
      });
      return;
    }
    await patchRows("google_photos_import_items", `id=eq.${encodeURIComponent(itemId)}`, {
      status: "queued",
      error_message: messageText,
      updated_at: new Date().toISOString(),
    });
    throw error;
  }
}

async function validAccessToken(job) {
  const current = decrypt(job.access_token_ciphertext);
  if (current && new Date(job.token_expires_at || 0).getTime() > Date.now() + 90_000) return current;
  if (!job.refresh_token_ciphertext) throw new Error("Autorização do Google expirada");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: decrypt(job.refresh_token_ciphertext),
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data?.error_description || "Google não renovou a autorização");
  const expiresAt = new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString();
  await patchRows("google_photos_import_jobs", `id=eq.${encodeURIComponent(job.id)}`, {
    access_token_ciphertext: encrypt(data.access_token),
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  return data.access_token;
}

async function refreshBaseUrlIfNeeded(item, job, accessToken, force = false) {
  if (!force && Date.now() - new Date(item.updated_at || item.created_at || 0).getTime() < 50 * 60_000) return item;
  let pageToken = "";
  do {
    const query = new URLSearchParams({ sessionId: job.picker_session_id, pageSize: "100" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || "Não foi possível renovar o endereço da mídia");
    const found = (data.mediaItems || []).find((candidate) => candidate.id === item.google_media_id);
    if (found?.mediaFile?.baseUrl) {
      const next = {
        ...item,
        base_url: found.mediaFile.baseUrl,
        mime_type: found.mediaFile.mimeType || item.mime_type,
        filename: found.mediaFile.filename || item.filename,
        updated_at: new Date().toISOString(),
      };
      await patchRows("google_photos_import_items", `id=eq.${encodeURIComponent(item.id)}`, {
        base_url: next.base_url,
        mime_type: next.mime_type,
        filename: next.filename,
        updated_at: next.updated_at,
      });
      return next;
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  throw new Error("Arquivo não encontrado na sessão do Google Fotos");
}

async function googleDownload(url, accessToken) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok || !response.body) {
    const error = new Error(`Download do Google falhou (${response.status})`);
    if ([401, 403, 404].includes(response.status)) error.code = "GOOGLE_MEDIA_URL_EXPIRED";
    throw error;
  }
  return response;
}

async function putStream(key, contentType, webBody, contentLength) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Readable.fromWeb(webBody),
    ContentType: contentType,
    ContentLength: contentLength ? Number(contentLength) : undefined,
    ServerSideEncryption: "AES256",
    CacheControl: "private, max-age=31536000, immutable",
  }));
}

async function indexFaces(agendaId, key, contentType) {
  if (!["image/jpeg", "image/png"].includes(contentType)) return [];
  const collectionId = `trilha_${String(agendaId).replace(/-/g, "_")}`;
  try {
    await rekognition.send(new CreateCollectionCommand({ CollectionId: collectionId }));
  } catch (error) {
    if (error?.name !== "ResourceAlreadyExistsException") throw error;
  }
  const result = await rekognition.send(new IndexFacesCommand({
    CollectionId: collectionId,
    Image: { S3Object: { Bucket: bucket, Name: key } },
    ExternalImageId: key.replace(/[^a-zA-Z0-9_.\-:]/g, "_").slice(0, 255),
    MaxFaces: 20,
    QualityFilter: "AUTO",
    DetectionAttributes: ["DEFAULT"],
  }));
  return (result.FaceRecords || []).map((record) => record.Face?.FaceId).filter(Boolean);
}

async function cleanupCompletedGoogleSession(job, accessToken) {
  const latest = await getOne("google_photos_import_jobs", `id=eq.${encodeURIComponent(job.id)}`);
  if (!latest || !["completed", "completed_with_errors"].includes(latest.status)) return;
  try {
    await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(job.picker_session_id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    console.warn("Não foi possível encerrar a sessão do Google Fotos", String(error?.message || error));
  }
  await patchRows("google_photos_import_jobs", `id=eq.${encodeURIComponent(job.id)}`, {
    access_token_ciphertext: null,
    refresh_token_ciphertext: null,
    picker_uri: "",
    updated_at: new Date().toISOString(),
  });
}

async function getOne(table, query) {
  const response = await supabaseFetch(`/rest/v1/${table}?${query}&limit=1`);
  return Array.isArray(response) ? response[0] || null : null;
}

async function patchRows(table, query, values) {
  await supabaseFetch(`/rest/v1/${table}?${query}`, { method: "PATCH", body: JSON.stringify(values) });
}

async function rpc(name, values) {
  return supabaseFetch(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(values) });
}

async function supabaseFetch(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || `Supabase respondeu ${response.status}`);
  return data;
}

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value) {
  const [ivValue, tagValue, encryptedValue] = String(value || "").split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Credencial criptografada inválida");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

function safeObjectName(value) {
  return String(value).normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150) || "arquivo-google";
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
