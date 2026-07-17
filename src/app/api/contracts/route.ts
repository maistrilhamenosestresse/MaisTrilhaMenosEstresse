import { NextResponse } from "next/server";
import {
  getContractDefinition,
  isContractType,
  type ContractType,
} from "@/lib/contracts";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { signClientContracts } from "@/lib/server/client-contracts";
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
  const client = await resolveClient(auth.user.id, auth.user.email);
  if (!client) return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });
  try {
    const contracts = await signClientContracts({
      client,
      signatureUrl,
      request,
      types: [type],
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      source: "app",
    });
    return NextResponse.json({ contract: contracts[0] });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || "Não foi possível registrar a assinatura",
    }, { status: 400 });
  }
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
