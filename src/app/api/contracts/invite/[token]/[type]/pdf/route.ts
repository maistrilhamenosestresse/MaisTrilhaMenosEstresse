import { NextResponse } from "next/server";
import { isContractType } from "@/lib/contracts";
import {
  ContractInviteError,
  resolveContractInvite,
} from "@/lib/server/contract-invites";
import { generateContractPdf } from "@/lib/server/contract-pdf";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string; type: string }> },
) {
  const rateLimit = await enforceRateLimit(request, "contract-invite-pdf", 30, 3600);
  if (rateLimit) return rateLimit;

  const { token, type } = await context.params;
  if (!isContractType(type)) {
    return NextResponse.json({ error: "Tipo de contrato inválido" }, { status: 400 });
  }

  try {
    const { client, supabase } = await resolveContractInvite(token);
    const { data: contract } = await supabase
      .from("client_contracts")
      .select("signed_at, signature_url, document_hash, document_snapshot")
      .eq("client_id", client.id)
      .eq("contract_type", type)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!contract) {
      return NextResponse.json({ error: "Contrato assinado não encontrado" }, { status: 404 });
    }

    const pdf = await generateContractPdf(contract);
    const safeName = String(client.full_name || "participante")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}-${safeName || "participante"}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ContractInviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Falha ao baixar contrato por convite:", error);
    return NextResponse.json({ error: "Não foi possível gerar a cópia" }, { status: 500 });
  }
}
