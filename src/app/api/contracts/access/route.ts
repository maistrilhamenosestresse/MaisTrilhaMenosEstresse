import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  sendContractAccessEmail,
  sendContractRegistrationInviteEmail,
} from "@/lib/server/contract-email";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

const GENERIC_RESPONSE =
  "Enviamos as próximas instruções para o e-mail informado. Se já houver cadastro, a mensagem terá o acesso aos contratos. Caso contrário, ela terá o link de cadastro e um passo a passo.";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const rateLimit = await enforceRateLimit(request, "contract-email-access", 5, 3600);
  if (rateLimit) return rateLimit;

  const parsed = await readJsonBody<{ email?: string }>(request, 5_000);
  if (parsed.response) return parsed.response;
  const email = String(parsed.data.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, full_name, email")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (clientError) {
    console.error("Falha ao verificar cadastro para acesso aos contratos:", clientError);
    return NextResponse.json(
      { error: "Não foi possível processar a solicitação agora. Tente novamente." },
      { status: 503 },
    );
  }

  try {
    const origin = configuredSiteOrigin(request);

    if (client?.email) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("contract_signing_invites").insert({
        client_id: client.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: null,
      });
      if (error) throw error;

      await sendContractAccessEmail({
        email: client.email,
        fullName: client.full_name,
        signingUrl: `${origin}/contratos/assinar/${encodeURIComponent(token)}`,
        expiresAt,
      });
    } else {
      const registrationUrl = new URL("/cadastro", `${origin}/`);
      registrationUrl.searchParams.set("email", email);
      registrationUrl.searchParams.set("origem", "contratos");
      await sendContractRegistrationInviteEmail({
        email,
        registrationUrl: registrationUrl.toString(),
      });
    }
  } catch (error) {
    console.error("Falha ao enviar instruções de contrato por e-mail:", error);
    return NextResponse.json(
      { error: "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos." },
      { status: 503 },
    );
  }

  return NextResponse.json({ success: true, message: GENERIC_RESPONSE });
}

function configuredSiteOrigin(request: Request) {
  const configured = String(
    process.env.NEXT_PUBLIC_BASE_URL
      || process.env.NEXT_PUBLIC_SITE_URL
      || process.env.NEXTAUTH_URL
      || "",
  ).trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.hostname === "localhost") return url.origin;
    } catch {
      // Usa a origem segura abaixo.
    }
  }

  const requestUrl = new URL(request.url);
  return requestUrl.hostname === "localhost"
    ? requestUrl.origin
    : "https://www.maistrilhasmenosestresse.com";
}
