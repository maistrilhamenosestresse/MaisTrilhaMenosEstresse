import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import {
  isWebPushConfigured,
  PUSH_TOPICS,
  sendPushCampaign,
  type PushTopic,
} from "@/lib/server/push-notifications";

type SendBody = {
  title?: string;
  body?: string;
  url?: string;
  topic?: string;
};

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push não configurado no servidor" }, { status: 503 });
  }
  const parsed = await readJsonBody<SendBody>(request, 20_000);
  if (parsed.response) return parsed.response;

  const topic = String(parsed.data.topic || "");
  if (!PUSH_TOPICS.includes(topic as PushTopic)) {
    return NextResponse.json({ error: "Categoria de notificação inválida" }, { status: 400 });
  }

  try {
    const result = await sendPushCampaign({
      title: String(parsed.data.title || ""),
      body: String(parsed.data.body || ""),
      url: String(parsed.data.url || "/app"),
      topic: topic as PushTopic,
      createdBy: auth.user.id,
      audience: "manual_admin_broadcast",
      tag: `admin-${Date.now()}`,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Falha ao enviar campanha push:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao enviar notificações" },
      { status: 500 },
    );
  }
}
