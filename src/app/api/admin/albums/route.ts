import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { BUCKET_NAME, s3Client } from "@/lib/aws";
import { requireAdminUser } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

export const dynamic = "force-dynamic";

type AlbumMetadataInput = {
  agendaId?: string;
  title?: string;
  description?: string;
  photographer?: string;
  published?: boolean;
};

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const supabase = createSupabaseAdmin();
  const agendaId = new URL(request.url).searchParams.get("agendaId");
  if (agendaId && !isUuid(agendaId)) {
    return NextResponse.json({ error: "Trilha inválida" }, { status: 400 });
  }

  const [agendasResult, photosResult, documentsResult] = await Promise.all([
    supabase
      .from("agendas")
      .select("id, title, date, meeting_point, flyer_url, images")
      .order("date", { ascending: false }),
    supabase
      .from("fotos_trilhas")
      .select("id, agenda_id, aws_key, aws_url, aws_face_id")
      .order("id", { ascending: false }),
    supabase
      .from("content_documents")
      .select("document_key, title, content, structured_content, published, version, updated_at")
      .like("document_key", "album:%"),
  ]);

  const firstError = [agendasResult.error, photosResult.error, documentsResult.error].find(Boolean);
  if (firstError) {
    console.error("Falha ao carregar gestão de álbuns:", firstError);
    return NextResponse.json({ error: "Não foi possível carregar os álbuns" }, { status: 500 });
  }

  const photos = photosResult.data || [];
  const documents = new Map(
    (documentsResult.data || []).map((document) => [
      String(document.document_key).replace(/^album:/, ""),
      document,
    ]),
  );
  const mediaCount = new Map<string, number>();
  const imageCount = new Map<string, number>();
  const videoCount = new Map<string, number>();
  for (const photo of photos) {
    const id = String(photo.agenda_id);
    mediaCount.set(id, (mediaCount.get(id) || 0) + 1);
    if (isVideoMedia(photo.aws_key, photo.aws_url)) {
      videoCount.set(id, (videoCount.get(id) || 0) + 1);
    } else {
      imageCount.set(id, (imageCount.get(id) || 0) + 1);
    }
  }

  const albums = (agendasResult.data || []).map((agenda) => {
    const document = documents.get(String(agenda.id));
    const structured = asRecord(document?.structured_content);
    return {
      agendaId: agenda.id,
      agendaTitle: agenda.title,
      agendaDate: agenda.date,
      location: agenda.meeting_point,
      coverUrl: structured.coverUrl || agenda.flyer_url || firstAgendaImage(agenda.images),
      title: document?.title || `Memórias de ${agenda.title}`,
      description: document?.content || "Fotos e momentos especiais desta aventura.",
      photographer: structured.photographer || "Equipe Mais Trilha Menos Estresse",
      published: document ? Boolean(document.published) : true,
      version: Number(document?.version || 0),
      updatedAt: document?.updated_at || null,
      mediaCount: mediaCount.get(String(agenda.id)) || 0,
      imageCount: imageCount.get(String(agenda.id)) || 0,
      videoCount: videoCount.get(String(agenda.id)) || 0,
    };
  });

  if (!agendaId) return NextResponse.json({ albums });

  const selectedMedia = photos.filter((photo) => String(photo.agenda_id) === agendaId);
  const media = await Promise.all(selectedMedia.map(async (photo, index) => ({
    id: photo.id,
    url: await signedMediaUrl(photo.aws_key, photo.aws_url),
    type: isVideoMedia(photo.aws_key, photo.aws_url) ? "video" : "image",
    faceCount: String(photo.aws_face_id || "").split(",").filter(Boolean).length,
    label: `${isVideoMedia(photo.aws_key, photo.aws_url) ? "Vídeo" : "Foto"} ${String(index + 1).padStart(3, "0")}`,
  })));

  return NextResponse.json({
    albums,
    album: albums.find((album) => album.agendaId === agendaId) || null,
    media,
  });
}

export async function PATCH(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const parsed = await readJsonBody<AlbumMetadataInput>(request, 30_000);
  if (parsed.response) return parsed.response;
  const agendaId = String(parsed.data.agendaId || "");
  const title = String(parsed.data.title || "").trim();
  const description = String(parsed.data.description || "").trim();
  const photographer = String(parsed.data.photographer || "").trim();
  if (!isUuid(agendaId) || title.length < 3 || title.length > 120) {
    return NextResponse.json({ error: "Informe uma trilha e um nome de álbum válido" }, { status: 400 });
  }
  if (description.length > 800 || photographer.length > 120) {
    return NextResponse.json({ error: "Os detalhes do álbum ultrapassam o tamanho permitido" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: agenda } = await supabase.from("agendas").select("id").eq("id", agendaId).maybeSingle();
  if (!agenda) return NextResponse.json({ error: "Trilha não encontrada" }, { status: 404 });

  const documentKey = `album:${agendaId}`;
  const { data: existing } = await supabase
    .from("content_documents")
    .select("version, structured_content")
    .eq("document_key", documentKey)
    .maybeSingle();
  const structured = asRecord(existing?.structured_content);
  const { error } = await supabase.from("content_documents").upsert({
    document_key: documentKey,
    title,
    content: description,
    structured_content: {
      ...structured,
      photographer: photographer || "Equipe Mais Trilha Menos Estresse",
      managedBy: "admin-albums",
    },
    mime_type: "application/vnd.maistrilha.album+json",
    published: parsed.data.published !== false,
    version: Number(existing?.version || 0) + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: "document_key" });
  if (error) {
    console.error("Falha ao salvar dados do álbum:", error);
    return NextResponse.json({ error: "Não foi possível salvar os dados do álbum" }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: "album.metadata_updated",
    resource_type: "trail_album",
    resource_id: agendaId,
    metadata: { title, published: parsed.data.published !== false },
  });

  return NextResponse.json({ success: true });
}

async function signedMediaUrl(key: unknown, fallback: unknown) {
  if (!key) return String(fallback || "");
  try {
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: String(key) }),
      { expiresIn: 60 * 60 },
    );
  } catch {
    return String(fallback || "");
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function isVideoMedia(key: unknown, url: unknown) {
  return /\.(mp4|mov|m4v)(?:\?|$)/i.test(String(key || url || ""));
}

function firstAgendaImage(value: unknown) {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    return typeof first === "string" ? first : null;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const first = parsed.find((item) => typeof item === "string" && item.trim());
        return typeof first === "string" ? first : null;
      }
    } catch {
      return value;
    }
  }
  return null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
