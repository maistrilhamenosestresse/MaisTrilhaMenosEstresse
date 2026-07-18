import "server-only";

import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { isAdminUser, resolveAuthenticatedClient } from "@/lib/server/auth";
import { trailMessageSigningPayload, type TrailMeshMessage } from "@trail-core";

export const OPERATION_EVENT_TYPES = new Set([
  "location",
  "status",
  "rest",
  "help",
  "sos",
  "incident",
  "checkpoint",
  "battery",
  "mesh_ack",
  "member_joined",
  "member_left",
  "system",
]);

export const OPERATION_MEMBER_STATUSES = new Set([
  "ok",
  "rest_requested",
  "help_requested",
  "sos",
  "off_route",
  "disconnected",
  "finished",
]);

export function createOperationJoinToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOperationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function resolveOperationAccess(user: User, operationId: string) {
  const supabase = createSupabaseAdmin();
  const admin = await isAdminUser(user);
  const { data: member } = await supabase
    .from("trail_operation_members")
    .select("*")
    .eq("operation_id", operationId)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return { admin, member };
}

export async function resolveOperationMember(user: User, operationId: string, deviceId?: string) {
  let query = createSupabaseAdmin()
    .from("trail_operation_members")
    .select("*")
    .eq("operation_id", operationId)
    .eq("auth_user_id", user.id);
  if (deviceId) query = query.eq("device_id", deviceId);
  const { data } = await query.maybeSingle();
  return data;
}

export async function memberIdentity(user: User) {
  const client = await resolveAuthenticatedClient(user);
  return {
    client,
    displayName: String(
      client?.full_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Participante",
    ).trim().slice(0, 150),
  };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function cleanDeviceId(value: unknown) {
  const deviceId = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(deviceId)) return null;
  return deviceId;
}

export function cleanSigningPublicKey(value: unknown) {
  const key = String(value || "").trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(key)) return null;
  try {
    return Buffer.from(key, "base64").length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function verifyTrailMessageSignature(message: TrailMeshMessage, rawPublicKey: string) {
  try {
    const raw = Buffer.from(rawPublicKey, "base64");
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = createPublicKey({
      key: Buffer.concat([spkiPrefix, raw]),
      format: "der",
      type: "spki",
    });
    return verify(
      null,
      Buffer.from(trailMessageSigningPayload(message), "utf8"),
      publicKey,
      Buffer.from(String(message.signature || ""), "base64"),
    );
  } catch {
    return false;
  }
}

export function normalizeOperationSettings(input: unknown) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return {
    location_interval_seconds: clampInteger(source.location_interval_seconds, 5, 120, 15),
    off_route_meters: clampInteger(source.off_route_meters, 20, 500, 50),
    max_hops: clampInteger(source.max_hops, 1, 16, 8),
    event_retention_days: clampInteger(source.event_retention_days, 1, 90, 30),
    participant_group_map: source.participant_group_map !== false,
  };
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}
