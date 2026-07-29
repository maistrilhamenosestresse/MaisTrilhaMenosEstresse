import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { requireServerEnv } from "@/lib/server/env";

export const ADMIN_SENSITIVE_COOKIE = "mt_admin_sensitive_unlock";
export const ADMIN_SENSITIVE_SESSION_SECONDS = 15 * 60;

type AdminSensitiveSession = {
  adminId: string;
  expiresAt: number;
  nonce: string;
};

function signingKey() {
  return createHmac("sha256", requireServerEnv("RATE_LIMIT_SECRET"))
    .update("mais-trilha:admin-sensitive-session:v1")
    .digest();
}

function signature(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyAdminSensitivePassword(password: string) {
  const expected = requireServerEnv("ADMIN_SENSITIVE_PASSWORD");
  const submittedDigest = createHmac("sha256", signingKey())
    .update(password)
    .digest();
  const expectedDigest = createHmac("sha256", signingKey())
    .update(expected)
    .digest();
  return timingSafeEqual(submittedDigest, expectedDigest);
}

export function createAdminSensitiveToken(adminId: string) {
  const session: AdminSensitiveSession = {
    adminId,
    expiresAt: Math.floor(Date.now() / 1000) + ADMIN_SENSITIVE_SESSION_SECONDS,
    nonce: randomBytes(18).toString("base64url"),
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export async function hasAdminSensitiveUnlock(adminId: string) {
  const token = (await cookies()).get(ADMIN_SENSITIVE_COOKIE)?.value;
  if (!token || token.length > 2_000) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;
  const payload = token.slice(0, separator);
  const receivedSignature = token.slice(separator + 1);
  if (!safeEqual(signature(payload), receivedSignature)) return false;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<AdminSensitiveSession>;
    return session.adminId === adminId &&
      typeof session.expiresAt === "number" &&
      session.expiresAt > Math.floor(Date.now() / 1000) &&
      typeof session.nonce === "string" &&
      session.nonce.length >= 20;
  } catch {
    return false;
  }
}

export function anonymizeAdminId(adminId: string) {
  return createHash("sha256").update(adminId).digest("hex").slice(0, 16);
}
