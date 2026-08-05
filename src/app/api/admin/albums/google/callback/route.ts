import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createGoogleOAuthClient,
  createPickerSession,
  encryptGoogleSecret,
  googlePhotosRedirectUri,
} from "@/lib/server/google-photos";
import { requireAdminUser } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

const OAUTH_COOKIE = "mt_google_photos_oauth";

type OAuthState = {
  state: string;
  verifier: string;
  agendaId: string;
  actorId: string;
  createdAt: number;
};

export async function GET(request: Request) {
  const target = new URL("/admin/albuns", request.url);
  const cookieStore = await cookies();
  try {
    const auth = await requireAdminUser();
    if (auth.response) return NextResponse.redirect(withError(target, "Sua sessão administrativa expirou."));

    const url = new URL(request.url);
    const providerError = url.searchParams.get("error");
    if (providerError) throw new Error(providerError === "access_denied" ? "A autorização do Google Fotos foi cancelada." : "O Google recusou a autorização.");

    const code = url.searchParams.get("code") || "";
    const returnedState = url.searchParams.get("state") || "";
    const rawCookie = cookieStore.get(OAUTH_COOKIE)?.value;
    if (!code || !returnedState || !rawCookie) throw new Error("A autorização perdeu a validade. Inicie novamente.");

    const state = JSON.parse(Buffer.from(rawCookie, "base64url").toString("utf8")) as OAuthState;
    if (
      state.state !== returnedState
      || state.actorId !== auth.user.id
      || Date.now() - Number(state.createdAt) > 10 * 60_000
      || !isUuid(state.agendaId)
    ) throw new Error("Não foi possível validar a segurança da autorização.");

    const redirectUri = googlePhotosRedirectUri(request.url);
    const oauth = createGoogleOAuthClient(redirectUri);
    const { tokens } = await oauth.getToken({ code, codeVerifier: state.verifier });
    if (!tokens.access_token) throw new Error("O Google não forneceu acesso às fotos.");
    const picker = await createPickerSession(tokens.access_token);
    if (!picker.id || !picker.pickerUri) throw new Error("O Google não criou a sessão de seleção.");

    const supabase = createSupabaseAdmin();
    const { data: job, error } = await supabase.from("google_photos_import_jobs").insert({
      agenda_id: state.agendaId,
      created_by: auth.user.id,
      status: "awaiting_selection",
      picker_session_id: picker.id,
      picker_uri: picker.pickerUri,
      access_token_ciphertext: encryptGoogleSecret(tokens.access_token),
      refresh_token_ciphertext: tokens.refresh_token ? encryptGoogleSecret(tokens.refresh_token) : null,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date(Date.now() + 50 * 60_000).toISOString(),
      picker_expires_at: picker.expireTime || null,
    }).select("id").single();
    if (error || !job) throw new Error("Não foi possível registrar a importação. A migration do Google Fotos foi aplicada?");

    await supabase.from("audit_logs").insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      action: "album.google_photos_connected",
      resource_type: "trail_album",
      resource_id: state.agendaId,
      metadata: { jobId: job.id, pickerExpiresAt: picker.expireTime || null },
    });

    target.searchParams.set("googleImportJob", job.id);
    target.searchParams.set("googleAlbumAgenda", state.agendaId);
    return NextResponse.redirect(target);
  } catch (error) {
    return NextResponse.redirect(withError(target, error instanceof Error ? error.message : "Falha ao conectar o Google Fotos."));
  } finally {
    cookieStore.delete(OAUTH_COOKIE);
  }
}

function withError(target: URL, message: string) {
  target.searchParams.set("googleImportError", message.slice(0, 300));
  return target;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
