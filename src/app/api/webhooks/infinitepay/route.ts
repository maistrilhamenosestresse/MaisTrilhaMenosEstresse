import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { verifyAndProcessInfinitePayPayment } from "@/lib/server/infinitepay-payment-processing";

export const dynamic = "force-dynamic";

type InfinitePayWebhook = {
  invoice_slug?: string;
  transaction_nsu?: string;
  order_nsu?: string;
  receipt_url?: string;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
  items?: unknown[];
};

export async function POST(request: Request) {
  const parsed = await readJsonBody<InfinitePayWebhook>(request, 100_000);
  if (parsed.response) return parsed.response;

  const orderNsu = safeIdentifier(parsed.data.order_nsu, 100);
  const transactionNsu = safeIdentifier(parsed.data.transaction_nsu, 150);
  const slug = safeIdentifier(parsed.data.invoice_slug, 150);
  if (!orderNsu || !transactionNsu || !slug) {
    return NextResponse.json(
      { success: false, message: "Identificadores do pagamento ausentes" },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdmin();
    const result = await verifyAndProcessInfinitePayPayment(supabase, {
      orderNsu,
      transactionNsu,
      slug,
      receiptUrl: parsed.data.receipt_url,
      payload: parsed.data as Record<string, unknown>,
    });
    return NextResponse.json({
      success: true,
      message: result.paid ? null : "Pagamento ainda não confirmado",
    });
  } catch (error: any) {
    console.error("Erro no webhook InfinitePay:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Falha ao confirmar pagamento" },
      { status: 400 },
    );
  }
}

function safeIdentifier(value: unknown, maxLength: number) {
  const normalized = String(value || "").trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    !/^[a-zA-Z0-9._:-]+$/.test(normalized)
  ) {
    return "";
  }
  return normalized;
}
