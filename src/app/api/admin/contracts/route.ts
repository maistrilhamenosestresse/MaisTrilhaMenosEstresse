import { NextResponse } from "next/server";
import {
  INSURANCE_CONTRACT_VERSION,
  RESPONSIBILITY_CONTRACT_VERSION,
} from "@/lib/contracts";
import { requireAdminUser } from "@/lib/server/auth";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const supabase = await createClient();
  const [{ data: clients, error: clientsError }, { data: contracts, error: contractsError }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name", { ascending: true }),
    supabase
      .from("client_contracts")
      .select("id, client_id, contract_type, version, signed_at")
      .order("signed_at", { ascending: false }),
  ]);
  if (clientsError || contractsError) {
    console.error("Falha ao carregar contratos no painel:", {
      clients: clientsError?.message,
      contracts: contractsError?.message,
    });
    return NextResponse.json({ error: "Não foi possível carregar os contratos" }, { status: 500 });
  }

  const byClient = new Map<string, any[]>();
  for (const contract of contracts || []) {
    const list = byClient.get(contract.client_id) || [];
    list.push(contract);
    byClient.set(contract.client_id, list);
  }

  const result = (clients || []).map((client) => {
    const signed = byClient.get(client.id) || [];
    const responsibility = signed.find((contract) => contract.contract_type === "responsibility");
    const insurance = signed.find((contract) => contract.contract_type === "insurance");
    return {
      ...client,
      contracts: {
        responsibility: responsibility || null,
        insurance: insurance || null,
      },
      contract_current: {
        responsibility: responsibility?.version === RESPONSIBILITY_CONTRACT_VERSION,
        insurance: insurance?.version === INSURANCE_CONTRACT_VERSION,
      },
    };
  });

  return NextResponse.json({
    clients: result,
    currentVersions: {
      responsibility: RESPONSIBILITY_CONTRACT_VERSION,
      insurance: INSURANCE_CONTRACT_VERSION,
    },
  });
}
