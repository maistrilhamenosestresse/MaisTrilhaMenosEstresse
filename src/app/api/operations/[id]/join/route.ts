import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuthenticatedRequest, isAdminUser } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import {
  cleanDeviceId,
  cleanSigningPublicKey,
  hashOperationToken,
  isUuid,
  memberIdentity,
} from "@/lib/server/trail-operations";

type JoinBody = {
  joinToken?: string;
  deviceId?: string;
  platform?: "android" | "ios";
  role?: "guide" | "assistant_guide" | "sweeper" | "participant";
  signingPublicKey?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedRequest(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Operação inválida" }, { status: 400 });
  const parsed = await readJsonBody<JoinBody>(request, 20_000);
  if (parsed.response) return parsed.response;

  const token = String(parsed.data.joinToken || "").trim();
  const deviceId = cleanDeviceId(parsed.data.deviceId);
  const signingPublicKey = cleanSigningPublicKey(parsed.data.signingPublicKey);
  if (!token || token.length > 500 || !deviceId || !signingPublicKey ||
      !["android", "ios"].includes(String(parsed.data.platform))) {
    return NextResponse.json({ error: "Convite ou dispositivo inválido" }, { status: 400 });
  }
  const supabase = createSupabaseAdmin();
  const { data: operation } = await supabase
    .from("trail_operations")
    .select("*, agendas(id, title, date, distance_km, difficulty)")
    .eq("id", id)
    .maybeSingle();
  if (!operation || ["completed", "cancelled"].includes(operation.status)) {
    return NextResponse.json({ error: "Operação encerrada ou inexistente" }, { status: 404 });
  }

  const expected = Buffer.from(operation.join_token_hash, "hex");
  const received = Buffer.from(hashOperationToken(token), "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: "Convite inválido" }, { status: 403 });
  }

  const admin = await isAdminUser(auth.user);
  const requestedRole = String(parsed.data.role || "participant");
  const role = admin && ["guide", "assistant_guide", "sweeper"].includes(requestedRole)
    ? requestedRole
    : "participant";
  const identity = await memberIdentity(auth.user);
  const { data: existing } = await supabase
    .from("trail_operation_members")
    .select("id")
    .eq("operation_id", id)
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  const memberPayload = {
    operation_id: id,
    client_id: identity.client?.id || null,
    auth_user_id: auth.user.id,
    role,
    display_name: identity.displayName,
    device_id: deviceId,
    signing_public_key: signingPublicKey,
    device_platform: parsed.data.platform,
    left_at: null,
    last_seen_at: new Date().toISOString(),
  };
  const memberQuery = existing
    ? supabase.from("trail_operation_members").update(memberPayload).eq("id", existing.id)
    : supabase.from("trail_operation_members").insert(memberPayload);
  const { data: member, error } = await memberQuery.select("*").single();
  if (error) return NextResponse.json({ error: "Não foi possível entrar na operação" }, { status: 400 });

  const [{ data: mapPack }, { data: pois }, { data: trailRoute }, { data: memberDirectory }] = await Promise.all([
    supabase.from("trail_offline_map_packs").select("*").eq("agenda_id", operation.agenda_id).eq("status", "published").maybeSingle(),
    supabase.from("trail_operation_pois").select("*").eq("agenda_id", operation.agenda_id).eq("active", true).order("sort_order"),
    supabase.from("trilha_gpx").select("geojson").eq("agenda_id", operation.agenda_id).maybeSingle(),
    supabase.from("trail_operation_members").select("id, signing_public_key").eq("operation_id", id).is("left_at", null),
  ]);

  return NextResponse.json({
    operation,
    member,
    mapPack,
    pois: pois || [],
    trailRoute: trailRoute?.geojson || null,
    memberDirectory: Object.fromEntries(
      (memberDirectory || []).map((entry) => [entry.id, entry.signing_public_key]),
    ),
  });
}
