import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { sendContractAccessEmail } from "@/lib/server/contract-email";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

const GENERIC_RESPONSE =
  "Se o e-mail estiver cadastrado, enviaremos um acesso seguro aos contratos.";

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
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, email")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (client?.email) {
    try {
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

      const configuredOrigin = String(
        process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "",
      ).replace(/\/$/, "");
      const origin = configuredOrigin || new URL(request.url).origin;
      await sendContractAccessEmail({
        email: client.email,
        fullName: client.full_name,
        signingUrl: `${origin}/contratos/assinar/${encodeURIComponent(token)}`,
        expiresAt,
      });
    } catch (error) {
      console.error("Falha ao gerar acesso de contrato por e-mail:", error);
    }
  }

  return NextResponse.json({ success: true, message: GENERIC_RESPONSE });
}
