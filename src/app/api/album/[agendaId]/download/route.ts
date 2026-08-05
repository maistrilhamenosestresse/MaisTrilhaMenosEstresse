import JSZip from "jszip";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME } from "@/lib/aws";
import { requireAgendaCustomer } from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  const { agendaId } = await context.params;
  return createAlbumArchive(agendaId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const parsed = await readJsonBody<{ photoIds?: string[] }>(request, 20_000);
  if (parsed.response) return parsed.response;
  const photoIds = Array.isArray(parsed.data.photoIds)
    ? [...new Set(parsed.data.photoIds.map(String))]
    : [];
  if (!photoIds.length || photoIds.length > 250 || photoIds.some((id) => !isUuid(id))) {
    return Response.json({ error: "Seleção de fotos inválida" }, { status: 400 });
  }
  const { agendaId } = await context.params;
  return createAlbumArchive(agendaId, photoIds);
}

async function createAlbumArchive(agendaId: string, photoIds?: string[]) {
  const auth = await requireAgendaCustomer(agendaId);
  if (auth.response) return auth.response;

  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("fotos_trilhas")
    .select("id, aws_key, aws_url, aws_face_id, original_aws_key, original_mime_type")
    .eq("agenda_id", agendaId)
    .limit(250);
  if (photoIds?.length) query = query.in("id", photoIds);
  const { data, error } = await query;
  if (error) return Response.json({ error: "Não foi possível carregar o álbum" }, { status: 500 });

  const downloadableMedia = (data || []).filter((photo) => {
    if (!photo.aws_face_id) return true;
    return photo.aws_face_id.split(",").filter((id: string) => id.trim()).length >= 3;
  });
  if (!downloadableMedia.length) {
    return Response.json({ error: "O álbum ainda não possui fotos disponíveis para este download" }, { status: 404 });
  }

  const { data: metadata } = await supabase
    .from("content_documents")
    .select("title")
    .eq("document_key", `album:${agendaId}`)
    .maybeSingle();
  const albumName = safeFilename(metadata?.title || `album-mais-trilha-${agendaId.slice(0, 8)}`);
  const zip = new JSZip();
  let included = 0;
  await Promise.all(downloadableMedia.map(async (photo, index) => {
    try {
      let bytes: Uint8Array;
      const downloadKey = photo.original_aws_key || photo.aws_key;
      if (downloadKey) {
        const object = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: downloadKey }));
        bytes = await object.Body!.transformToByteArray();
      } else {
        const response = await fetch(photo.aws_url);
        if (!response.ok) return;
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      const extension = extensionFromMime(photo.original_mime_type)
        || String(photo.original_aws_key || photo.aws_key || photo.aws_url || "").match(/\.(png|webp|heic|heif|jpe?g|mp4|mov|m4v)(?:\?|$)/i)?.[1]?.toLowerCase()
        || "jpg";
      const kind = ["mp4", "mov", "m4v"].includes(extension) ? "video" : "foto";
      zip.file(`${kind}-${String(index + 1).padStart(3, "0")}.${extension}`, bytes, { compression: "STORE" });
      included += 1;
    } catch {
      // Uma mídia indisponível não impede o download das demais.
    }
  }));
  if (!included) return Response.json({ error: "Nenhuma foto pôde ser baixada" }, { status: 502 });

  // STORE preserva os bytes originais e evita recomprimir imagens e vídeos.
  const archive = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  return new Response(archive as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${albumName}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "album-mais-trilha";
}

function extensionFromMime(value: unknown) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
  };
  return extensions[String(value || "").toLowerCase()] || "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
