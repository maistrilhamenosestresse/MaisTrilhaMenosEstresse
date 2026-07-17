import { NextResponse } from "next/server";
import { isContractType } from "@/lib/contracts";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { generateContractPdf } from "@/lib/server/contract-pdf";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ type: string }> },
) {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const { type } = await context.params;
  if (!isContractType(type)) {
    return NextResponse.json({ error: "Tipo de contrato inválido" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  let { data: client } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (!client && auth.user.email) {
    const result = await supabase
      .from("clients")
      .select("id, full_name")
      .ilike("email", auth.user.email)
      .limit(1)
      .maybeSingle();
    client = result.data;
  }
  if (!client) return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });

  const { data: contract, error } = await supabase
    .from("client_contracts")
    .select("signed_at, signature_url, document_hash, document_snapshot")
    .eq("client_id", client.id)
    .eq("contract_type", type)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !contract) {
    return NextResponse.json({ error: "Contrato assinado não encontrado" }, { status: 404 });
  }

  const pdf = await generateContractPdf(contract as any);
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
}
