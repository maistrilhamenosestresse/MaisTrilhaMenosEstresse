import { NextResponse } from "next/server";
import {
  requireAdminRequest,
  requireAuthenticatedRequest,
  isAdminUser,
} from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import {
  cleanDeviceId,
  cleanSigningPublicKey,
  createOperationJoinToken,
  hashOperationToken,
  isUuid,
  memberIdentity,
  normalizeOperationSettings,
} from "@/lib/server/trail-operations";

type CreateOperationBody = {
  agendaId?: string;
  name?: string;
  startsAt?: string;
  deviceId?: string;
  sessionKeyFingerprint?: string;
  signingPublicKey?: string;
  settings?: Record<string, unknown>;
};

export async function GET(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (auth.response) return auth.response;
  const supabase = createSupabaseAdmin();
  const admin = await isAdminUser(auth.user);

  let operationIds: string[] | null = null;
  if (!admin) {
    const { data: memberships, error } = await supabase
      .from("trail_operation_members")
      .select("operation_id")
      .eq("auth_user_id", auth.user.id);
    if (error) return NextResponse.json({ error: "Falha ao consultar operações" }, { status: 500 });
    operationIds = (memberships || []).map((membership) => membership.operation_id);
    if (!operationIds.length) return NextResponse.json({ operations: [] });
  }

  let query = supabase
    .from("trail_operations")
    .select("id, agenda_id, name, status, starts_at, ended_at, settings, created_at, agendas(title, date, distance_km, difficulty)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (operationIds) query = query.in("id", operationIds);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Falha ao consultar operações" }, { status: 500 });
  if (!admin) return NextResponse.json({ operations: data || [] });
  const { data: availableAgendas } = await supabase
    .from("agendas")
    .select("id, title, date, distance_km, difficulty")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: true })
    .limit(200);
  return NextResponse.json({ operations: data || [], availableAgendas: availableAgendas || [] });
}

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;
  const parsed = await readJsonBody<CreateOperationBody>(request, 30_000);
  if (parsed.response) return parsed.response;

  const agendaId = parsed.data.agendaId;
  const deviceId = cleanDeviceId(parsed.data.deviceId || `guide-console-${auth.user.id}`);
  const signingPublicKey = cleanSigningPublicKey(parsed.data.signingPublicKey);
  if (!isUuid(agendaId) || !deviceId || !signingPublicKey) {
    return NextResponse.json({ error: "Agenda ou dispositivo inválido" }, { status: 400 });
  }
  const supabase = createSupabaseAdmin();
  const { data: agenda } = await supabase
    .from("agendas")
    .select("id, title, date")
    .eq("id", agendaId)
    .maybeSingle();
  if (!agenda) return NextResponse.json({ error: "Trilha não encontrada" }, { status: 404 });

  const joinToken = createOperationJoinToken();
  const identity = await memberIdentity(auth.user);
  const name = String(parsed.data.name || `Operação ${agenda.title}`).trim().slice(0, 150);
  const startsAt = parsed.data.startsAt && Number.isFinite(Date.parse(parsed.data.startsAt))
    ? new Date(parsed.data.startsAt).toISOString()
    : null;
  const fingerprint = String(parsed.data.sessionKeyFingerprint || "").trim().slice(0, 128) || null;

  const { data: operation, error } = await supabase
    .from("trail_operations")
    .insert({
      agenda_id: agendaId,
      name,
      created_by: auth.user.id,
      primary_guide_user_id: auth.user.id,
      starts_at: startsAt,
      join_token_hash: hashOperationToken(joinToken),
      session_key_fingerprint: fingerprint,
      settings: normalizeOperationSettings(parsed.data.settings),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Não foi possível criar a operação" }, { status: 400 });

  const { data: member, error: memberError } = await supabase
    .from("trail_operation_members")
    .insert({
      operation_id: operation.id,
      client_id: identity.client?.id || null,
      auth_user_id: auth.user.id,
      role: "guide",
      display_name: identity.displayName,
      device_id: deviceId,
      signing_public_key: signingPublicKey,
      device_platform: null,
      last_seen_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (memberError) {
    await supabase.from("trail_operations").delete().eq("id", operation.id);
    return NextResponse.json({ error: "Não foi possível registrar o guia" }, { status: 400 });
  }

  return NextResponse.json({ operation, member, joinToken }, { status: 201 });
}
