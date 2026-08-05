import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthClient,
  createPkcePair,
  googlePhotosConfigured,
  googlePhotosRedirectUri,
} from "@/lib/server/google-photos";
import { requireAdminUser } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

const OAUTH_COOKIE = "mt_google_photos_oauth";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;
  if (!googlePhotosConfigured()) {
    return NextResponse.json({
      error: "Integração ainda não configurada. Informe as credenciais OAuth do Google Fotos e a fila AWS.",
      setupRequired: true,
    }, { status: 503 });
  }

  const parsed = await readJsonBody<{ agendaId?: string }>(request, 20_000);
  if (parsed.response) return parsed.response;
  const agendaId = String(parsed.data.agendaId || "");
  if (!isUuid(agendaId)) return NextResponse.json({ error: "Trilha inválida" }, { status: 400 });

  const { data: agenda } = await createSupabaseAdmin().from("agendas").select("id").eq("id", agendaId).maybeSingle();
  if (!agenda) return NextResponse.json({ error: "Trilha não encontrada" }, { status: 404 });

  const state = randomBytes(32).toString("base64url");
  const pkce = createPkcePair();
  const redirectUri = googlePhotosRedirectUri(request.url);
  const oauth = createGoogleOAuthClient(redirectUri);
  const authorizationUrl = buildGoogleAuthorizationUrl(oauth, state, pkce.challenge);
  const payload = Buffer.from(JSON.stringify({
    state,
    verifier: pkce.verifier,
    agendaId,
    actorId: auth.user.id,
    createdAt: Date.now(),
  })).toString("base64url");

  (await cookies()).set(OAUTH_COOKIE, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/albums/google",
    maxAge: 10 * 60,
    priority: "high",
  });

  return NextResponse.json({ authorizationUrl });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
