import { NextResponse } from "next/server";
import {
  getContractDefinition,
  getCurrentContractVersion,
} from "@/lib/contracts";
import { signClientContracts } from "@/lib/server/client-contracts";
import {
  ContractInviteError,
  resolveContractInvite,
} from "@/lib/server/contract-invites";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

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
  let resolved;
  try {
    resolved = await resolveContractInvite(token);
  } catch (error) {
    return inviteErrorResponse(error);
  }

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
  let resolved;
  try {
    resolved = await resolveContractInvite(token, { requireUnused: true });
  } catch (error) {
    return inviteErrorResponse(error);
  }

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
    console.error("Falha ao registrar contratos pelo convite:", error);
    return NextResponse.json({
      error: "Não foi possível registrar os contratos",
    }, { status: 400 });
  }
}

function inviteErrorResponse(error: unknown) {
  if (error instanceof ContractInviteError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Falha ao validar convite de contrato:", error);
  return NextResponse.json({ error: "Não foi possível validar este acesso" }, { status: 500 });
}

function maskCpf(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 11 ? `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**` : "CPF cadastrado";
}
