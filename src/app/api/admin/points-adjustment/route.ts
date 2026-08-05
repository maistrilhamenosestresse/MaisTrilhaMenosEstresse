import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

type AdjustmentInput = {
  clientId?: string;
  operation?: "add" | "remove";
  points?: number;
  reason?: string;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const parsed = await readJsonBody<AdjustmentInput>(request, 20_000);
  if (parsed.response) return parsed.response;
  const clientId = String(parsed.data.clientId || "");
  const operation = parsed.data.operation;
  const points = Number(parsed.data.points);
  const reason = String(parsed.data.reason || "").trim();
  if (!isUuid(clientId) || !["add", "remove"].includes(String(operation))) {
    return NextResponse.json({ error: "Selecione o cliente e o tipo de ajuste" }, { status: 400 });
  }
  if (!Number.isInteger(points) || points < 1 || points > 100_000 || reason.length < 5 || reason.length > 180) {
    return NextResponse.json({ error: "Informe uma quantidade válida e explique o motivo" }, { status: 400 });
  }

  const delta = operation === "remove" ? -points : points;
  const { data, error } = await createSupabaseAdmin().rpc("admin_adjust_client_points", {
    p_client_id: clientId,
    p_delta: delta,
    p_reason: reason,
    p_actor_id: auth.user.id,
    p_actor_email: auth.user.email || null,
  });
  if (error) {
    console.error("Falha ao ajustar pontos do cliente:", error);
    const safeMessage = error.message.includes("possui apenas")
      ? error.message
      : "Não foi possível ajustar os pontos. Verifique se a atualização do banco foi aplicada.";
    return NextResponse.json({ error: safeMessage }, { status: 400 });
  }

  return NextResponse.json({ success: true, adjustment: data });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
