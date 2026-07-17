import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildContractSnapshot,
  getContractDefinition,
  isContractType,
  type ContractType,
} from "@/lib/contracts";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

type ContractSignBody = {
  contract_type?: ContractType;
  signature_url?: string;
};

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const client = await resolveClient(auth.user.id, auth.user.email);
  if (!client) return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });

  const { data: contracts, error } = await createSupabaseAdmin()
    .from("client_contracts")
    .select("id, contract_type, version, title, signature_url, signed_at, document_hash")
    .eq("client_id", client.id)
    .order("signed_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Não foi possível carregar os contratos" }, { status: 500 });

  return NextResponse.json({
    client: {
      id: client.id,
      full_name: client.full_name,
      cpf: client.cpf,
      rg: client.rg,
      birth_date: client.birth_date,
      phone: client.phone,
      email: client.email,
      emergency_contact_name: client.emergency_contact_name,
      emergency_contact_phone: client.emergency_contact_phone,
      health_notes: client.health_notes,
    },
    definitions: [
      getContractDefinition("responsibility"),
      getContractDefinition("insurance"),
    ],
    contracts: contracts || [],
  });
}

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const parsed = await readJsonBody<ContractSignBody>(request, 20_000);
  if (parsed.response) return parsed.response;
  const type = String(parsed.data.contract_type || "");
  const signatureUrl = String(parsed.data.signature_url || "").trim();
  if (!isContractType(type)) {
    return NextResponse.json({ error: "Tipo de contrato inválido" }, { status: 400 });
  }
  if (!isAllowedMediaUrl(signatureUrl)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  const client = await resolveClient(auth.user.id, auth.user.email);
  if (!client) return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });
  if (!client.full_name || !client.cpf || !client.birth_date || !client.phone) {
    return NextResponse.json({
      error: "Complete nome, CPF, nascimento e telefone antes de assinar.",
    }, { status: 409 });
  }

  const snapshot = buildContractSnapshot(type, client);
  const documentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const requestHeaders = request.headers;
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const hashSecret = process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "contract";
  const ipHash = forwardedFor
    ? createHash("sha256").update(`${hashSecret}:${forwardedFor}`).digest("hex")
    : null;
  const signedAt = new Date().toISOString();
  const supabase = createSupabaseAdmin();
  const { data: contract, error } = await supabase
    .from("client_contracts")
    .upsert({
      client_id: client.id,
      contract_type: type,
      version: snapshot.version,
      title: snapshot.title,
      signature_url: signatureUrl,
      document_snapshot: snapshot,
      document_hash: documentHash,
      signed_at: signedAt,
      ip_hash: ipHash,
      user_agent: requestHeaders.get("user-agent")?.slice(0, 500) || null,
    }, { onConflict: "client_id,contract_type,version" })
    .select("id, contract_type, version, title, signature_url, signed_at, document_hash")
    .single();

  if (error) {
    return NextResponse.json({ error: "Não foi possível registrar a assinatura" }, { status: 500 });
  }

  if (type === "responsibility") {
    await supabase.from("clients").update({
      signature_url: signatureUrl,
      accepted_terms_at: signedAt,
    }).eq("id", client.id);
  }
  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: "contract.signed",
    resource_type: "client_contract",
    resource_id: contract.id,
    metadata: { contractType: type, version: snapshot.version, documentHash },
  });

  return NextResponse.json({ contract });
}

async function resolveClient(userId: string, email?: string) {
  const supabase = createSupabaseAdmin();
  const { data: linked } = await supabase.from("clients").select("*").eq("auth_user_id", userId).maybeSingle();
  if (linked) return linked;
  if (!email) return null;
  const { data } = await supabase.from("clients").select("*").ilike("email", email).limit(1).maybeSingle();
  if (data && !data.auth_user_id) {
    await supabase.from("clients").update({ auth_user_id: userId }).eq("id", data.id).is("auth_user_id", null);
    data.auth_user_id = userId;
  }
  return data?.auth_user_id === userId ? data : null;
}

function isAllowedMediaUrl(value: string) {
  try {
    const url = new URL(value);
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || "us-east-1";
    return !!bucket && url.protocol === "https:" && url.hostname === `${bucket}.s3.${region}.amazonaws.com`;
  } catch {
    return false;
  }
}
