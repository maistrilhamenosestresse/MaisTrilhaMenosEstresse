import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { DeleteFacesCommand } from "@aws-sdk/client-rekognition";
import { NextResponse } from "next/server";
import { BUCKET_NAME, rekognitionClient, s3Client } from "@/lib/aws";
import { requireAdminUser } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

type BulkDeleteInput = { agendaId?: string; mediaIds?: string[] };

export async function DELETE(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const parsed = await readJsonBody<BulkDeleteInput>(request, 50_000);
  if (parsed.response) return parsed.response;
  const agendaId = String(parsed.data.agendaId || "");
  const mediaIds = [...new Set((parsed.data.mediaIds || []).map(String))];
  if (!isUuid(agendaId) || !mediaIds.length || mediaIds.length > 500 || mediaIds.some((id) => !isUuid(id))) {
    return NextResponse.json({ error: "Seleção inválida. Exclua no máximo 500 arquivos por vez." }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const rows: Array<{ id: string; agenda_id: string; aws_key: string | null; aws_face_id: string | null }> = [];
  for (const ids of chunk(mediaIds, 100)) {
    const { data, error } = await supabase
      .from("fotos_trilhas")
      .select("id, agenda_id, aws_key, aws_face_id")
      .eq("agenda_id", agendaId)
      .in("id", ids);
    if (error) return NextResponse.json({ error: "Não foi possível carregar os arquivos selecionados" }, { status: 500 });
    rows.push(...(data || []));
  }
  if (!rows.length) return NextResponse.json({ error: "Nenhum arquivo selecionado foi encontrado" }, { status: 404 });

  for (const ids of chunk(rows.map((row) => row.id), 100)) {
    const { error } = await supabase.from("fotos_trilhas").delete().eq("agenda_id", agendaId).in("id", ids);
    if (error) return NextResponse.json({ error: "Não foi possível concluir a exclusão do álbum" }, { status: 500 });
  }

  const cleanupWarnings: string[] = [];
  const faceIds = rows.flatMap((row) => String(row.aws_face_id || "").split(",").map((id) => id.trim()).filter(Boolean));
  for (const ids of chunk(faceIds, 4096)) {
    try {
      await rekognitionClient.send(new DeleteFacesCommand({
        CollectionId: `trilha_${agendaId.replace(/-/g, "_")}`,
        FaceIds: ids,
      }));
    } catch (error) {
      console.warn("Falha ao remover lote de índices faciais:", error);
      cleanupWarnings.push("Alguns índices faciais exigem nova tentativa");
    }
  }

  const keys = rows.map((row) => row.aws_key).filter((key): key is string => Boolean(key));
  for (const objectKeys of chunk(keys, 1000)) {
    try {
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: objectKeys.map((Key) => ({ Key })), Quiet: true },
      }));
    } catch (error) {
      console.warn("Falha ao remover lote de mídias da AWS:", error);
      cleanupWarnings.push("Alguns arquivos da AWS exigem nova tentativa");
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: "album.media_bulk_deleted",
    resource_type: "trail_album",
    resource_id: agendaId,
    metadata: { requested: mediaIds.length, deleted: rows.length, cleanupWarnings },
  });

  return NextResponse.json({ success: true, deleted: rows.length, cleanupWarnings: [...new Set(cleanupWarnings)] });
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
