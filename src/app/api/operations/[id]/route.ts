import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import {
  createOperationJoinToken,
  hashOperationToken,
  isUuid,
  normalizeOperationSettings,
  resolveOperationAccess,
} from "@/lib/server/trail-operations";

type UpdateOperationBody = {
  status?: "planned" | "check_in" | "active" | "paused" | "completed" | "cancelled";
  name?: string;
  startsAt?: string | null;
  settings?: Record<string, unknown>;
  rotateJoinToken?: boolean;
};

const OPERATION_STATUSES = new Set([
  "planned", "check_in", "active", "paused", "completed", "cancelled",
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedRequest(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Operação inválida" }, { status: 400 });
  const access = await resolveOperationAccess(auth.user, id);
  if (!access.admin && !access.member) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();
  const { data: operation } = await supabase
    .from("trail_operations")
    .select("*, agendas(id, title, date, distance_km, difficulty)")
    .eq("id", id)
    .maybeSingle();
  if (!operation) return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });

  const [{ data: members }, { data: locations }, { data: reports }, { data: mapPack }, { data: pois }, { data: trailRoute }] =
    await Promise.all([
      supabase.from("trail_operation_members").select("*").eq("operation_id", id).order("display_name"),
      supabase.from("trail_operation_latest_locations").select("*").eq("operation_id", id),
      supabase.from("trail_operation_reports").select("*").eq("operation_id", id).order("created_at", { ascending: false }).limit(200),
      supabase.from("trail_offline_map_packs").select("*").eq("agenda_id", operation.agenda_id).eq("status", "published").maybeSingle(),
      supabase.from("trail_operation_pois").select("*").eq("agenda_id", operation.agenda_id).eq("active", true).order("sort_order"),
      supabase.from("trilha_gpx").select("geojson").eq("agenda_id", operation.agenda_id).maybeSingle(),
    ]);

  return NextResponse.json({
    operation,
    currentMember: access.member,
    permissions: { admin: access.admin },
    members: members || [],
    locations: locations || [],
    reports: reports || [],
    mapPack,
    pois: pois || [],
    trailRoute: trailRoute?.geojson || null,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAuthenticatedRequest(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Operação inválida" }, { status: 400 });
  const access = await resolveOperationAccess(auth.user, id);
  const guide = access.member && ["guide", "assistant_guide"].includes(access.member.role);
  if (!access.admin && !guide) {
    return NextResponse.json({ error: "Acesso de guia necessário" }, { status: 403 });
  }
  const parsed = await readJsonBody<UpdateOperationBody>(request, 30_000);
  if (parsed.response) return parsed.response;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) {
    const name = String(parsed.data.name).trim().slice(0, 150);
    if (!name) return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
    updates.name = name;
  }
  if (parsed.data.status !== undefined) {
    if (!OPERATION_STATUSES.has(parsed.data.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    updates.status = parsed.data.status;
    if (parsed.data.status === "active") updates.starts_at = new Date().toISOString();
    if (["completed", "cancelled"].includes(parsed.data.status)) updates.ended_at = new Date().toISOString();
  }
  if (parsed.data.startsAt !== undefined) {
    if (parsed.data.startsAt !== null && !Number.isFinite(Date.parse(parsed.data.startsAt))) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }
    updates.starts_at = parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : null;
  }
  if (parsed.data.settings !== undefined) updates.settings = normalizeOperationSettings(parsed.data.settings);

  let joinToken: string | undefined;
  if (parsed.data.rotateJoinToken) {
    joinToken = createOperationJoinToken();
    updates.join_token_hash = hashOperationToken(joinToken);
  }

  const { data: operation, error } = await createSupabaseAdmin()
    .from("trail_operations")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Não foi possível atualizar a operação" }, { status: 400 });
  return NextResponse.json({ operation, joinToken });
}
