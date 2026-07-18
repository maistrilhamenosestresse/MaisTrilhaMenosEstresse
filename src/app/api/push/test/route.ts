import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertSameOrigin } from "@/lib/server/request";
import {
  isWebPushConfigured,
  sendPushCampaign,
} from "@/lib/server/push-notifications";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const rateLimit = await enforceRateLimit(request, "push-self-test", 5, 3600);
  if (rateLimit) return rateLimit;

  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Notificações ainda não configuradas" }, { status: 503 });
  }

  try {
    const result = await sendPushCampaign({
      title: "Notificações ativadas!",
      body: "Tudo certo neste aparelho. Você já pode receber novidades da Mais Trilha.",
      url: "/app/configuracoes",
      authUserIds: [auth.user.id],
      createdBy: auth.user.id,
      audience: "self_test",
      tag: "push-test",
    });

    if (result.skipped) {
      return NextResponse.json({ success: true, skipped: true });
    }
    if (result.recipients === 0) {
      return NextResponse.json({ error: "Este aparelho ainda não concluiu a inscrição" }, { status: 409 });
    }
    if (result.sent === 0) {
      return NextResponse.json({ error: "O serviço do aparelho recusou a notificação de teste" }, { status: 502 });
    }

    return NextResponse.json({ success: true, sent: result.sent });
  } catch (error: any) {
    console.error("Falha no teste de notificação:", error);
    return NextResponse.json(
      { error: error.message || "Não foi possível enviar o teste" },
      { status: 500 },
    );
  }
}
