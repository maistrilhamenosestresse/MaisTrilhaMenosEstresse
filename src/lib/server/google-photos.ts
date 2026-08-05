import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { requireServerEnv } from "@/lib/server/env";

export const GOOGLE_PHOTOS_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const PICKER_API = "https://photospicker.googleapis.com/v1";

export type GoogleImportJobSecret = {
  id: string;
  picker_session_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
};

export type PickedMediaItem = {
  id: string;
  type: "PHOTO" | "VIDEO" | "TYPE_UNSPECIFIED";
  createTime?: string;
  mediaFile?: {
    baseUrl?: string;
    mimeType?: string;
    filename?: string;
    mediaFileMetadata?: { videoMetadata?: { processingStatus?: string } };
  };
};

export function googlePhotosConfigured() {
  return Boolean(
    process.env.GOOGLE_PHOTOS_CLIENT_ID?.trim()
    && process.env.GOOGLE_PHOTOS_CLIENT_SECRET?.trim()
    && process.env.GOOGLE_PHOTOS_IMPORT_QUEUE_URL?.trim()
    && process.env.GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY?.trim(),
  );
}

export function googlePhotosRedirectUri(requestUrl: string) {
  const configured = process.env.GOOGLE_PHOTOS_REDIRECT_URI?.trim();
  if (configured) return configured;
  const requestOrigin = new URL(requestUrl).origin;
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || requestOrigin;
  return new URL("/api/admin/albums/google/callback", base).toString();
}

export function createGoogleOAuthClient(redirectUri: string) {
  return new OAuth2Client(
    requireServerEnv("GOOGLE_PHOTOS_CLIENT_ID"),
    requireServerEnv("GOOGLE_PHOTOS_CLIENT_SECRET"),
    redirectUri,
  );
}

export function buildGoogleAuthorizationUrl(oauth: OAuth2Client, state: string, codeChallenge: string) {
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [GOOGLE_PHOTOS_SCOPE],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function encryptGoogleSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptGoogleSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Credencial criptografada inválida");
  const decipher = createDecipheriv("aes-256-gcm", tokenEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function ensureGoogleAccessToken(
  job: GoogleImportJobSecret,
  updateTokens: (values: { access_token_ciphertext: string; token_expires_at: string | null }) => Promise<void>,
) {
  const currentToken = decryptGoogleSecret(job.access_token_ciphertext);
  const expiresAt = job.token_expires_at ? new Date(job.token_expires_at).getTime() : 0;
  if (currentToken && expiresAt > Date.now() + 90_000) return currentToken;
  if (!job.refresh_token_ciphertext) throw new Error("A autorização do Google expirou. Conecte o Google Fotos novamente.");

  const oauth = createGoogleOAuthClient(process.env.GOOGLE_PHOTOS_REDIRECT_URI || "postmessage");
  oauth.setCredentials({
    access_token: currentToken,
    refresh_token: decryptGoogleSecret(job.refresh_token_ciphertext),
    expiry_date: expiresAt || undefined,
  });
  const response = await oauth.getAccessToken();
  const token = response.token;
  if (!token) throw new Error("O Google não renovou a autorização da importação");
  const nextExpiry = oauth.credentials.expiry_date
    ? new Date(oauth.credentials.expiry_date).toISOString()
    : new Date(Date.now() + 50 * 60_000).toISOString();
  await updateTokens({ access_token_ciphertext: encryptGoogleSecret(token), token_expires_at: nextExpiry });
  return token;
}

export async function createPickerSession(accessToken: string) {
  return pickerRequest<{
    id: string;
    pickerUri: string;
    expireTime?: string;
    mediaItemsSet?: boolean;
  }>("/sessions", accessToken, {
    method: "POST",
    body: JSON.stringify({ pickingConfig: { maxItemCount: "2000" } }),
  });
}

export async function getPickerSession(sessionId: string, accessToken: string) {
  return pickerRequest<{
    id: string;
    pickerUri: string;
    expireTime?: string;
    mediaItemsSet?: boolean;
    pollingConfig?: { pollInterval?: string; timeoutIn?: string };
  }>(`/sessions/${encodeURIComponent(sessionId)}`, accessToken);
}

export async function deletePickerSession(sessionId: string, accessToken: string) {
  await pickerRequest<Record<string, never>>(`/sessions/${encodeURIComponent(sessionId)}`, accessToken, { method: "DELETE" });
}

export async function listPickedMedia(sessionId: string, accessToken: string) {
  const allItems: PickedMediaItem[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ sessionId, pageSize: "100" });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await pickerRequest<{ mediaItems?: PickedMediaItem[]; nextPageToken?: string }>(
      `/mediaItems?${query.toString()}`,
      accessToken,
    );
    allItems.push(...(page.mediaItems || []));
    pageToken = page.nextPageToken || "";
    if (allItems.length > 2000) throw new Error("O Google retornou mais itens que o limite permitido");
  } while (pageToken);
  return allItems;
}

export async function enqueueGoogleImportItems(items: Array<{ id: string; job_id: string }>) {
  const queueUrl = requireServerEnv("GOOGLE_PHOTOS_IMPORT_QUEUE_URL");
  const client = new SQSClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: requireServerEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requireServerEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });

  const batches = [];
  for (let offset = 0; offset < items.length; offset += 10) {
    const batch = items.slice(offset, offset + 10);
    batches.push(new SendMessageBatchCommand({
      QueueUrl: queueUrl,
      Entries: batch.map((item, index) => ({
        Id: `${offset + index}-${item.id.replace(/-/g, "")}`.slice(0, 80),
        MessageBody: JSON.stringify({ itemId: item.id, jobId: item.job_id }),
      })),
    }));
  }
  for (let offset = 0; offset < batches.length; offset += 5) {
    const results = await Promise.all(batches.slice(offset, offset + 5).map((command) => client.send(command)));
    const failed = results.reduce((total, result) => total + (result.Failed?.length || 0), 0);
    if (failed) throw new Error(`A AWS recusou ${failed} item(ns) da fila`);
  }
}

export function safeGoogleFilename(value: string, mimeType: string, mediaId: string) {
  const extension = extensionForMime(mimeType);
  const original = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  const base = original.replace(/\.[^.]+$/, "") || `google-${mediaId.slice(0, 20)}`;
  return `${base}.${extension}`;
}

async function pickerRequest<T>(path: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`${PICKER_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Google Fotos respondeu ${response.status}`;
    throw new Error(String(message));
  }
  return data as T;
}

function tokenEncryptionKey() {
  const configured = requireServerEnv("GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY");
  const decoded = Buffer.from(configured, "base64url");
  if (decoded.length !== 32) throw new Error("GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY deve possuir 32 bytes em base64url");
  return decoded;
}

function extensionForMime(mimeType: string) {
  const types: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
  };
  return types[mimeType.toLowerCase()] || (mimeType.startsWith("video/") ? "mp4" : "jpg");
}
