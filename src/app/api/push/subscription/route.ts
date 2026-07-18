import { NextResponse } from "next/server";
import {
  requireAuthenticatedUser,
  resolveAuthenticatedClient,
} from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import {
  getPublicVapidKey,
  isWebPushConfigured,
  PUSH_TOPICS,
  type PushTopic,
} from "@/lib/server/push-notifications";

export const dynamic = "force-dynamic";

type SubscriptionBody = {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  topics?: string[];
  platform?: string;
};

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;

  const configured = isWebPushConfigured();
  const supabase = createSupabaseAdmin();
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", auth.user.id)
    .eq("enabled", true);

  return NextResponse.json({
    configured,
    publicKey: configured ? getPublicVapidKey() : null,
    subscribed: Number(count || 0) > 0,
  });
}

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Notificações ainda não configuradas" }, { status: 503 });
  }
  const parsed = await readJsonBody<SubscriptionBody>(request, 30_000);
  if (parsed.response) return parsed.response;

  const endpoint = String(parsed.data.subscription?.endpoint || "").trim();
  const p256dh = String(parsed.data.subscription?.keys?.p256dh || "").trim();
  const authKey = String(parsed.data.subscription?.keys?.auth || "").trim();
  const topics = normalizeTopics(parsed.data.topics);
  const platform = normalizePlatform(parsed.data.platform);
  if (
    !isValidEndpoint(endpoint) ||
    !isBase64UrlKey(p256dh, 300) ||
    !isBase64UrlKey(authKey, 200)
  ) {
    return NextResponse.json({ error: "Inscrição push inválida" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: existing } = await supabase
    .from("push_subscriptions")
    .select("auth_user_id")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (existing && existing.auth_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Inscrição vinculada a outra conta" }, { status: 409 });
  }
  const client = await resolveAuthenticatedClient(auth.user);
  const { error } = await supabase.from("push_subscriptions").upsert({
    auth_user_id: auth.user.id,
    client_id: client?.id || null,
    endpoint,
    p256dh,
    auth_key: authKey,
    topics,
    platform,
    user_agent: String(request.headers.get("user-agent") || "").slice(0, 500),
    enabled: true,
    failure_count: 0,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) throw error;

  return NextResponse.json({ success: true, topics });
}

export async function DELETE(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedUser();
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<{ endpoint?: string }>(request, 10_000);
  if (parsed.response) return parsed.response;
  const endpoint = String(parsed.data.endpoint || "").trim();
  if (!isValidEndpoint(endpoint)) {
    return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
  }

  const { error } = await createSupabaseAdmin()
    .from("push_subscriptions")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("auth_user_id", auth.user.id)
    .eq("endpoint", endpoint);
  if (error) throw error;
  return NextResponse.json({ success: true });
}

function normalizeTopics(input?: string[]): PushTopic[] {
  const requested = Array.isArray(input) ? input : [...PUSH_TOPICS];
  return PUSH_TOPICS.filter((topic) => requested.includes(topic));
}

function normalizePlatform(value?: string) {
  return ["ios", "android", "desktop"].includes(String(value))
    ? String(value)
    : "web";
}

function isValidEndpoint(value: string) {
  if (value.length < 20 || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isBase64UrlKey(value: string, maxLength: number) {
  return value.length >= 16 && value.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(value);
}
