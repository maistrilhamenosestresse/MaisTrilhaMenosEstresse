import { NextResponse } from "next/server";
import {
  getAsaasInstallmentPaymentBook,
  getAsaasPayment,
} from "@/lib/asaas";
import {
  requireAuthenticatedUser,
  resolveAuthenticatedClient,
} from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const paymentId = new URL(request.url).searchParams.get("paymentId") || "";
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    return NextResponse.json({ error: "Pagamento inválido" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const client = await resolveAuthenticatedClient(auth.user);
  if (!client) {
    return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });
  }

  const { data: record } = await supabase
    .from("asaas_payments")
    .select("id")
    .eq("id", paymentId)
    .eq("client_id", client.id)
    .maybeSingle();
  if (!record) {
    return NextResponse.json(
      { error: "Pagamento não pertence a este cadastro" },
      { status: 403 },
    );
  }

  try {
    const payment = await getAsaasPayment(paymentId);
    const installmentId = String(payment.installment || "");
    if (!installmentId) {
      return NextResponse.json(
        { error: "Esta cobrança não possui carnê" },
        { status: 400 },
      );
    }

    const response = await getAsaasInstallmentPaymentBook(installmentId);
    const pdf = await response.arrayBuffer();
    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="carne-mais-trilha-${installmentId}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("Erro ao gerar carnê Asaas:", error);
    return NextResponse.json(
      { error: error.message || "Não foi possível gerar o carnê" },
      { status: 502 },
    );
  }
}
