import "server-only";

import { createHash } from "node:crypto";
import {
  buildContractSnapshot,
  type ContractType,
} from "@/lib/contracts";
import { requireServerEnv } from "@/lib/server/env";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

type SignClientContractsInput = {
  client: Record<string, any>;
  signatureUrl: string;
  request: Request;
  types: ContractType[];
  actorId?: string | null;
  actorEmail?: string | null;
  source: "app" | "registration" | "invite";
};

export async function signClientContracts({
  client,
  signatureUrl,
  request,
  types,
  actorId = null,
  actorEmail = null,
  source,
}: SignClientContractsInput) {
  const uniqueTypes = [...new Set(types)];
  if (!uniqueTypes.length) throw new Error("Nenhum contrato selecionado");
  if (!isAllowedSignatureUrl(signatureUrl)) throw new Error("Assinatura inválida");
  if (!client?.id || !client.full_name || !client.cpf || !client.birth_date || !client.phone) {
    throw new Error("Complete nome, CPF, nascimento e telefone antes de assinar");
  }

  const signedAt = new Date().toISOString();
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const hashSecret = requireServerEnv("REGISTRATION_SIGNING_SECRET");
  const ipHash = forwardedFor
    ? createHash("sha256").update(`${hashSecret}:${forwardedFor}`).digest("hex")
    : null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;
  const rows = uniqueTypes.map((type) => {
    const snapshot = buildContractSnapshot(type, client);
    return {
      client_id: client.id,
      contract_type: type,
      version: snapshot.version,
      title: snapshot.title,
      signature_url: signatureUrl,
      document_snapshot: snapshot,
      document_hash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
      signed_at: signedAt,
      ip_hash: ipHash,
      user_agent: userAgent,
    };
  });

  const supabase = createSupabaseAdmin();
  const { data: contracts, error } = await supabase
    .from("client_contracts")
    .upsert(rows, { onConflict: "client_id,contract_type,version" })
    .select("id, contract_type, version, title, signature_url, signed_at, document_hash");
  if (error) throw error;

  await supabase.from("clients").update({
    signature_url: signatureUrl,
    accepted_terms_at: signedAt,
  }).eq("id", client.id);

  await supabase.from("audit_logs").insert(
    (contracts || []).map((contract) => ({
      actor_id: actorId,
      actor_email: actorEmail,
      action: "contract.signed",
      resource_type: "client_contract",
      resource_id: contract.id,
      metadata: {
        contractType: contract.contract_type,
        version: contract.version,
        documentHash: contract.document_hash,
        source,
      },
    })),
  );

  return contracts || [];
}

export function isAllowedSignatureUrl(value: string) {
  try {
    const url = new URL(value);
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || "us-east-1";
    return !!bucket &&
      url.protocol === "https:" &&
      url.hostname === `${bucket}.s3.${region}.amazonaws.com` &&
      url.pathname.startsWith("/signatures/");
  } catch {
    return false;
  }
}
