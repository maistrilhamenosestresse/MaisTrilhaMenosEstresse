import { NextResponse } from "next/server";
import { getAsaasInstallmentPaymentBook } from "@/lib/asaas";
import { requireAdminUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) {
    return NextResponse.json({ error: "Parcelamento inválido" }, { status: 400 });
  }

  try {
    const response = await getAsaasInstallmentPaymentBook(id);
    const pdf = await response.arrayBuffer();
    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="carne-asaas-${id}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("Erro ao gerar carnê Asaas para o administrador:", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o carnê" },
      { status: 502 },
    );
  }
}
