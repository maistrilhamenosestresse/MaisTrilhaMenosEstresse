import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

type InviteBody = {
  clientId?: string;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const parsed = await readJsonBody<InviteBody>(request, 10_000);
  if (parsed.response) return parsed.response;
  const clientId = String(parsed.data.clientId || "");
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, phone")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("contract_signing_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .is("used_at", null);

  const { error } = await supabase.from("contract_signing_invites").insert({
    client_id: clientId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by: auth.user.id,
  });
  if (error) {
    return NextResponse.json({ error: "Não foi possível gerar o link" }, { status: 500 });
  }

  const configuredOrigin = String(process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  const origin = configuredOrigin || new URL(request.url).origin;
  const signingUrl = `${origin}/contratos/assinar/${encodeURIComponent(token)}`;

  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: "contract.invite_created",
    resource_type: "client",
    resource_id: clientId,
    metadata: { expiresAt },
  });

  return NextResponse.json({
    signingUrl,
    expiresAt,
    client: {
      id: client.id,
      full_name: client.full_name,
      phone: client.phone,
    },
  });
}
