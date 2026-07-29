import { NextResponse } from "next/server";
import {
  ADMIN_SENSITIVE_COOKIE,
  ADMIN_SENSITIVE_SESSION_SECONDS,
  anonymizeAdminId,
  createAdminSensitiveToken,
  verifyAdminSensitivePassword,
} from "@/lib/server/admin-sensitive-session";
import { requireAdminUser } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

type UnlockInput = {
  password?: string;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const rateLimit = await enforceRateLimit(
    request,
    `admin-sensitive-unlock:${anonymizeAdminId(auth.user.id)}`,
    5,
    15 * 60,
  );
  if (rateLimit) return rateLimit;

  const parsed = await readJsonBody<UnlockInput>(request, 2_000);
  if (parsed.response) return parsed.response;
  const password = String(parsed.data.password || "");
  if (password.length < 4 || password.length > 128 ||
      !verifyAdminSensitivePassword(password)) {
    return NextResponse.json(
      { error: "Credencial administrativa inválida" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    success: true,
    expiresIn: ADMIN_SENSITIVE_SESSION_SECONDS,
  });
  response.cookies.set({
    name: ADMIN_SENSITIVE_COOKIE,
    value: createAdminSensitiveToken(auth.user.id),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SENSITIVE_SESSION_SECONDS,
  });

  await createSupabaseAdmin().from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: "admin.sensitive_session_unlocked",
    resource_type: "admin_session",
    metadata: {
      expires_in_seconds: ADMIN_SENSITIVE_SESSION_SECONDS,
    },
  });

  return response;
}
