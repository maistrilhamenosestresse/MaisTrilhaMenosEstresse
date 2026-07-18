import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export class ContractInviteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ContractInviteError";
  }
}

export async function resolveContractInvite(
  tokenValue: string,
  options: { requireUnused?: boolean } = {},
) {
  const token = String(tokenValue || "");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    throw new ContractInviteError("Link inválido", 400);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createSupabaseAdmin();
  const { data: invite } = await supabase
    .from("contract_signing_invites")
    .select("id, client_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite || new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new ContractInviteError(
      "Este link expirou. Informe seu e-mail novamente para receber um novo acesso.",
      410,
    );
  }
  if (options.requireUnused && invite.used_at) {
    throw new ContractInviteError(
      "Este link já foi utilizado para assinar. Solicite um novo acesso para consultar suas cópias.",
      410,
    );
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", invite.client_id)
    .maybeSingle();
  if (!client) {
    throw new ContractInviteError("Cadastro não encontrado", 404);
  }

  return { invite, client, supabase };
}
