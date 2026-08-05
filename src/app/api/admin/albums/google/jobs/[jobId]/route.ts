import { NextResponse } from "next/server";
import {
  ensureGoogleAccessToken,
  enqueueGoogleImportItems,
  getPickerSession,
  listPickedMedia,
  safeGoogleFilename,
  type GoogleImportJobSecret,
} from "@/lib/server/google-photos";
import { requireAdminUser } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin } from "@/lib/server/request";

export const dynamic = "force-dynamic";

const SAFE_FIELDS = "id, agenda_id, status, picker_uri, picker_expires_at, total_items, queued_items, processed_items, failed_items, error_message, created_at, updated_at, completed_at";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;
  const { jobId } = await context.params;
  if (!isUuid(jobId)) return NextResponse.json({ error: "Importação inválida" }, { status: 400 });
  return loadSafeJob(jobId);
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;
  const { jobId } = await context.params;
  if (!isUuid(jobId)) return NextResponse.json({ error: "Importação inválida" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data: job, error: jobError } = await supabase
    .from("google_photos_import_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError || !job) return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });
  if (["queued", "processing", "completed", "completed_with_errors", "failed", "expired", "cancelled"].includes(job.status)) {
    return loadSafeJob(jobId);
  }

  try {
    if (job.picker_expires_at && new Date(job.picker_expires_at).getTime() <= Date.now()) {
      await supabase.from("google_photos_import_jobs").update({ status: "expired", error_message: "A seleção do Google Fotos expirou", updated_at: new Date().toISOString() }).eq("id", jobId);
      return loadSafeJob(jobId);
    }

    const accessToken = await ensureGoogleAccessToken(job as GoogleImportJobSecret, async (values) => {
      const { error } = await supabase.from("google_photos_import_jobs").update({ ...values, updated_at: new Date().toISOString() }).eq("id", jobId);
      if (error) throw new Error("Não foi possível renovar a autorização do Google");
    });
    const picker = await getPickerSession(job.picker_session_id, accessToken);
    if (!picker.mediaItemsSet) {
      return NextResponse.json({
        job: sanitizeJob(job),
        ready: false,
        pickerUri: `${String(job.picker_uri).replace(/\/$/, "")}/autoclose`,
        pollIntervalMs: parseGoogleDuration(picker.pollingConfig?.pollInterval, 3000),
      });
    }

    const picked = await listPickedMedia(job.picker_session_id, accessToken);
    const validItems = picked.flatMap((item) => {
      const file = item.mediaFile;
      const mimeType = String(file?.mimeType || "").toLowerCase();
      if (!item.id || !file?.baseUrl || !mimeType || (!mimeType.startsWith("image/") && !mimeType.startsWith("video/"))) return [];
      return [{
        job_id: jobId,
        google_media_id: item.id,
        filename: safeGoogleFilename(String(file.filename || ""), mimeType, item.id),
        mime_type: mimeType,
        base_url: file.baseUrl,
        status: "queued",
        error_message: null,
        updated_at: new Date().toISOString(),
      }];
    });
    if (!validItems.length) throw new Error("Nenhuma foto ou vídeo válido foi selecionado no Google Fotos");
    if (validItems.length > 2000) throw new Error("Selecione no máximo 2.000 arquivos por importação");

    const { error: itemError } = await supabase
      .from("google_photos_import_items")
      .upsert(validItems, { onConflict: "job_id,google_media_id", ignoreDuplicates: true });
    if (itemError) throw new Error("Não foi possível preparar os arquivos selecionados");
    const storedItems: Array<{ id: string; job_id: string }> = [];
    for (let offset = 0; offset < 2000; offset += 500) {
      const { data: page, error: storedItemsError } = await supabase
        .from("google_photos_import_items")
        .select("id, job_id")
        .eq("job_id", jobId)
        .range(offset, offset + 499);
      if (storedItemsError) throw new Error("Não foi possível carregar a fila de arquivos selecionados");
      storedItems.push(...(page || []));
      if ((page || []).length < 500) break;
    }
    if (!storedItems.length) throw new Error("Nenhum arquivo foi preparado para importação");

    const { data: claimed, error: claimError } = await supabase
      .from("google_photos_import_jobs")
      .update({
        status: "queued",
        total_items: storedItems.length,
        queued_items: storedItems.length,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "awaiting_selection")
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error("Não foi possível iniciar a fila de importação");
    if (!claimed) return loadSafeJob(jobId);

    try {
      await enqueueGoogleImportItems(storedItems);
    } catch (error) {
      await supabase.from("google_photos_import_jobs").update({
        status: "awaiting_selection",
        error_message: error instanceof Error ? error.message.slice(0, 500) : "Falha na fila AWS",
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      throw error;
    }

    await supabase.from("audit_logs").insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      action: "album.google_photos_import_queued",
      resource_type: "trail_album",
      resource_id: job.agenda_id,
      metadata: { jobId, itemCount: storedItems.length },
    });
    return loadSafeJob(jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao preparar a importação";
    await supabase.from("google_photos_import_jobs").update({ error_message: message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", jobId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function loadSafeJob(jobId: string) {
  const { data, error } = await createSupabaseAdmin()
    .from("google_photos_import_jobs")
    .select(SAFE_FIELDS)
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });
  return NextResponse.json({ job: sanitizeJob(data), ready: data.status !== "awaiting_selection" });
}

function sanitizeJob(job: Record<string, unknown>) {
  return {
    id: job.id,
    agendaId: job.agenda_id,
    status: job.status,
    pickerUri: job.status === "awaiting_selection" ? `${String(job.picker_uri || "").replace(/\/$/, "")}/autoclose` : null,
    pickerExpiresAt: job.picker_expires_at,
    totalItems: Number(job.total_items || 0),
    queuedItems: Number(job.queued_items || 0),
    processedItems: Number(job.processed_items || 0),
    failedItems: Number(job.failed_items || 0),
    errorMessage: job.error_message,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: job.completed_at,
  };
}

function parseGoogleDuration(value: string | undefined, fallback: number) {
  const seconds = Number(String(value || "").replace(/s$/, ""));
  return Number.isFinite(seconds) && seconds > 0 ? Math.max(1000, Math.round(seconds * 1000)) : fallback;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
