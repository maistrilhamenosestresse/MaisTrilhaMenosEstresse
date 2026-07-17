import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getContractDefinition,
  getCurrentContractVersion,
} from "@/lib/contracts";
import { signClientContracts } from "@/lib/server/client-contracts";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

type InviteSignBody = {
  signature_url?: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const rateLimit = await enforceRateLimit(request, "contract-invite-read", 60, 3600);
  if (rateLimit) return rateLimit;

  const { token } = await context.params;
  const resolved = await resolveInvite(token);
  if (resolved.response) return resolved.response;

  const { client, invite, supabase } = resolved;
  const { data: contracts } = await supabase
    .from("client_contracts")
    .select("contract_type, version, signed_at")
    .eq("client_id", client.id)
    .order("signed_at", { ascending: false });

  const current = {
    responsibility: contracts?.some((contract) =>
      contract.contract_type === "responsibility" &&
      contract.version === getCurrentContractVersion("responsibility")
    ) || false,
    insurance: contracts?.some((contract) =>
      contract.contract_type === "insurance" &&
      contract.version === getCurrentContractVersion("insurance")
    ) || false,
  };

  return NextResponse.json({
    client: {
      full_name: client.full_name,
      cpf_masked: maskCpf(client.cpf),
    },
    definitions: [
      getContractDefinition("responsibility"),
      getContractDefinition("insurance"),
    ],
    current,
    expiresAt: invite.expires_at,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const rateLimit = await enforceRateLimit(request, "contract-invite-sign", 10, 3600);
  if (rateLimit) return rateLimit;

  const { token } = await context.params;
  const resolved = await resolveInvite(token);
  if (resolved.response) return resolved.response;

  const parsed = await readJsonBody<InviteSignBody>(request, 20_000);
  if (parsed.response) return parsed.response;
  const signatureUrl = String(parsed.data.signature_url || "").trim();

  try {
    const contracts = await signClientContracts({
      client: resolved.client,
      signatureUrl,
      request,
      types: ["responsibility", "insurance"],
      source: "invite",
    });
    await resolved.supabase
      .from("contract_signing_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resolved.invite.id)
      .is("used_at", null);

    return NextResponse.json({ success: true, contracts });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || "Não foi possível registrar os contratos",
    }, { status: 400 });
  }
}

async function resolveInvite(tokenValue: string) {
  const token = String(tokenValue || "");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return {
      response: NextResponse.json({ error: "Link inválido" }, { status: 400 }),
    } as const;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createSupabaseAdmin();
  const { data: invite } = await supabase
    .from("contract_signing_invites")
    .select("id, client_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!invite || invite.used_at || new Date(invite.expires_at).getTime() <= Date.now()) {
    return {
      response: NextResponse.json({
        error: "Este link expirou ou já foi utilizado. Solicite um novo link.",
      }, { status: 410 }),
    } as const;
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", invite.client_id)
    .maybeSingle();
  if (!client) {
    return {
      response: NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 }),
    } as const;
  }

  return { invite, client, supabase, response: null } as const;
}

function maskCpf(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 11 ? `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**` : "CPF cadastrado";
}
