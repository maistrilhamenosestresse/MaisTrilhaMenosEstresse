import "server-only";

import webpush, { type PushSubscription } from "web-push";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireServerEnv } from "@/lib/server/env";

export const PUSH_TOPICS = [
  "new_trails",
  "reservation_reminders",
  "benefits",
] as const;

export type PushTopic = (typeof PUSH_TOPICS)[number];

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  badgeCount?: number;
};

type PushCampaignInput = PushPayload & {
  topic?: PushTopic;
  clientIds?: string[];
  authUserIds?: string[];
  createdBy?: string;
  dedupeKey?: string;
  audience?: string;
};

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  failure_count: number;
};

export function getPublicVapidKey() {
  return requireServerEnv("WEB_PUSH_VAPID_PUBLIC_KEY");
}

export function isWebPushConfigured() {
  return Boolean(
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() &&
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() &&
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim()
  );
}

export async function sendPushCampaign(input: PushCampaignInput) {
  configureWebPush();
  const supabase = createSupabaseAdmin();
  const title = cleanText(input.title, 80);
  const body = cleanText(input.body, 240);
  const url = normalizeTargetUrl(input.url);
  if (!title || !body) throw new Error("Título e mensagem são obrigatórios");

  const campaignInsert = await supabase
    .from("push_campaigns")
    .insert({
      dedupe_key: input.dedupeKey || null,
      created_by: input.createdBy || null,
      title,
      body,
      target_url: url,
      topic: input.topic || null,
      audience: cleanText(input.audience || "subscribers", 80),
      status: "sending",
    })
    .select("id")
    .single();

  if (campaignInsert.error) {
    if (campaignInsert.error.code === "23505" && input.dedupeKey) {
      return { skipped: true, recipients: 0, sent: 0, failed: 0 };
    }
    throw campaignInsert.error;
  }

  const campaignId = campaignInsert.data.id;
  try {
    let query = supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, failure_count")
      .eq("enabled", true)
      .limit(2000);
    if (input.topic) query = query.contains("topics", [input.topic]);
    if (input.clientIds?.length) {
      query = query.in("client_id", [...new Set(input.clientIds)].slice(0, 1000));
    }
    if (input.authUserIds?.length) {
      query = query.in("auth_user_id", [...new Set(input.authUserIds)].slice(0, 1000));
    }

    const { data, error } = await query;
    if (error) throw error;
    const subscriptions = (data || []) as StoredSubscription[];
    const payload = JSON.stringify({
      title,
      body,
      url,
      tag: cleanText(input.tag || input.dedupeKey || "mais-trilha", 100),
      badgeCount: Math.max(1, Math.min(99, Number(input.badgeCount || 1))),
      icon: process.env.NEXT_PUBLIC_LOGO_URL || undefined,
    });

    let sent = 0;
    let failed = 0;
    for (let offset = 0; offset < subscriptions.length; offset += 20) {
      const batch = subscriptions.slice(offset, offset + 20);
      const outcomes = await Promise.all(batch.map((subscription) =>
        sendStoredSubscription(subscription, payload)
      ));
      sent += outcomes.filter((outcome) => outcome).length;
      failed += outcomes.filter((outcome) => !outcome).length;
    }

    await supabase.from("push_campaigns").update({
      status: "completed",
      recipient_count: subscriptions.length,
      sent_count: sent,
      failed_count: failed,
      completed_at: new Date().toISOString(),
    }).eq("id", campaignId);

    return {
      skipped: false,
      recipients: subscriptions.length,
      sent,
      failed,
    };
  } catch (error: any) {
    await supabase.from("push_campaigns").update({
      status: "failed",
      error_message: String(error?.message || error).slice(0, 500),
      completed_at: new Date().toISOString(),
    }).eq("id", campaignId);
    throw error;
  }
}

async function sendStoredSubscription(
  subscription: StoredSubscription,
  payload: string,
) {
  const supabase = createSupabaseAdmin();
  const webSubscription: PushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth_key,
    },
  };
  try {
    await webpush.sendNotification(webSubscription, payload, {
      TTL: 60 * 60 * 12,
      urgency: "normal",
    });
    await supabase.from("push_subscriptions").update({
      failure_count: 0,
      last_success_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
    return true;
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || 0);
    const permanentlyInvalid = statusCode === 404 || statusCode === 410;
    await supabase.from("push_subscriptions").update({
      enabled: permanentlyInvalid ? false : true,
      failure_count: Number(subscription.failure_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
    return false;
  }
}

function configureWebPush() {
  const subject = requireServerEnv("WEB_PUSH_VAPID_SUBJECT");
  if (!/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(subject) && !/^https:\/\//.test(subject)) {
    throw new Error("WEB_PUSH_VAPID_SUBJECT inválido");
  }
  webpush.setVapidDetails(
    subject,
    requireServerEnv("WEB_PUSH_VAPID_PUBLIC_KEY"),
    requireServerEnv("WEB_PUSH_VAPID_PRIVATE_KEY"),
  );
}

function normalizeTargetUrl(value: string) {
  const input = String(value || "/app").trim();
  if (input.startsWith("/app")) return input.slice(0, 500);
  try {
    const url = new URL(input);
    const officialHost = new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.maistrilhasmenosestresse.com",
    ).host;
    if (url.protocol === "https:" && url.host === officialHost && url.pathname.startsWith("/app")) {
      return `${url.pathname}${url.search}`.slice(0, 500);
    }
  } catch {
    // A URL inválida cai no destino seguro.
  }
  return "/app";
}

function cleanText(value: string, maxLength: number) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength);
}
