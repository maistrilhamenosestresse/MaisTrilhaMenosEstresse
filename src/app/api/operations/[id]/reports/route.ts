import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { isUuid, resolveOperationAccess } from "@/lib/server/trail-operations";

const REPORT_TYPES = new Set(["incident", "medical", "hazard", "rest", "equipment", "wildlife", "route", "other"]);
const SEVERITIES = new Set(["info", "attention", "urgent", "critical"]);
const REPORT_STATUSES = new Set(["open", "acknowledged", "resolved", "dismissed"]);

type ReportBody = {
  reportType?: string;
  severity?: string;
  title?: string;
  description?: string;
  relatedMemberId?: string;
  latitude?: number;
  longitude?: number;
  mediaKeys?: string[];
  clientCreatedAt?: string;
};

type UpdateReportBody = {
  reportId?: string;
  status?: string;
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
  const access = await resolveOperationAccess(auth.user, id);
  if (!access.member || access.member.left_at) {
    return NextResponse.json({ error: "Participante não autorizado" }, { status: 403 });
  }
  const parsed = await readJsonBody<ReportBody>(request, 80_000);
  if (parsed.response) return parsed.response;
  const reportType = String(parsed.data.reportType || "");
  const severity = String(parsed.data.severity || "info");
  const title = String(parsed.data.title || "").trim().slice(0, 180);
  const description = String(parsed.data.description || "").trim().slice(0, 4000) || null;
  const relatedMemberId = parsed.data.relatedMemberId;
  const latitude = parsed.data.latitude;
  const longitude = parsed.data.longitude;
  const mediaKeys = Array.isArray(parsed.data.mediaKeys)
    ? parsed.data.mediaKeys.map(String).filter((key) => key.length <= 500).slice(0, 10)
    : [];
  const clientCreatedAt = parsed.data.clientCreatedAt && Number.isFinite(Date.parse(parsed.data.clientCreatedAt))
    ? new Date(parsed.data.clientCreatedAt).toISOString()
    : new Date().toISOString();

  if (!REPORT_TYPES.has(reportType) || !SEVERITIES.has(severity) || !title ||
      (relatedMemberId !== undefined && !isUuid(relatedMemberId)) ||
      (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return NextResponse.json({ error: "Relatório inválido" }, { status: 400 });
  }
  const { data, error } = await createSupabaseAdmin().from("trail_operation_reports").insert({
    operation_id: id,
    reporter_member_id: access.member.id,
    related_member_id: relatedMemberId || null,
    report_type: reportType,
    severity,
    title,
    description,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    media_keys: mediaKeys,
    client_created_at: clientCreatedAt,
  }).select("*").single();
  if (error) return NextResponse.json({ error: "Não foi possível registrar o relatório" }, { status: 400 });
  return NextResponse.json({ report: data }, { status: 201 });
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
  if (!access.admin && !guide) return NextResponse.json({ error: "Acesso de guia necessário" }, { status: 403 });
  const parsed = await readJsonBody<UpdateReportBody>(request, 10_000);
  if (parsed.response) return parsed.response;
  if (!isUuid(parsed.data.reportId) || !REPORT_STATUSES.has(String(parsed.data.status))) {
    return NextResponse.json({ error: "Atualização inválida" }, { status: 400 });
  }
  const resolved = ["resolved", "dismissed"].includes(String(parsed.data.status));
  const { data, error } = await createSupabaseAdmin().from("trail_operation_reports").update({
    status: parsed.data.status,
    resolved_at: resolved ? new Date().toISOString() : null,
    resolved_by: resolved ? auth.user.id : null,
  }).eq("id", parsed.data.reportId).eq("operation_id", id).select("*").single();
  if (error) return NextResponse.json({ error: "Não foi possível atualizar o relatório" }, { status: 400 });
  return NextResponse.json({ report: data });
}
