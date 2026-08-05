import { NextResponse } from "next/server";
import { isAdminUser, requireAuthenticatedUser, resolveAuthenticatedClient } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

type AlbumCounts = {
  total: number;
  publicMedia: number;
  searchablePhotos: number;
  landscapes: number;
  groups: number;
  privatePortraits: number;
  videos: number;
};

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (auth.response) return auth.response;

    const supabase = createSupabaseAdmin();
    const adminPreview = await isAdminUser(auth.user);
    let eligibleAgendaIds: string[] | null = null;

    if (!adminPreview) {
      const client = await resolveAuthenticatedClient(auth.user);
      if (!client) {
        return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
      }

      const { data: reservations, error: reservationsError } = await supabase
        .from("reservas")
        .select("agenda_id")
        .eq("client_id", client.id)
        .eq("status_pagamento", "pago");
      if (reservationsError) throw reservationsError;

      eligibleAgendaIds = [...new Set((reservations || []).map((reservation) => String(reservation.agenda_id)).filter(Boolean))];
      if (!eligibleAgendaIds.length) return NextResponse.json({ tours: [], admin_preview: false });
    }

    let mediaQuery = supabase
      .from("fotos_trilhas")
      .select("agenda_id, aws_face_id, aws_key, aws_url");
    if (eligibleAgendaIds) mediaQuery = mediaQuery.in("agenda_id", eligibleAgendaIds);
    const { data: albumRows, error: albumError } = await mediaQuery;
    if (albumError) throw albumError;

    const albumAgendaIds = [...new Set((albumRows || []).map((row) => String(row.agenda_id)).filter(Boolean))];
    if (!albumAgendaIds.length) return NextResponse.json({ tours: [], admin_preview: adminPreview });

    const [{ data: albumDocuments, error: documentsError }, { data: agendas, error: agendasError }] = await Promise.all([
      supabase
        .from("content_documents")
        .select("document_key, title, content, structured_content, published")
        .in("document_key", albumAgendaIds.map((id) => `album:${id}`)),
      supabase
        .from("agendas")
        .select("id, title, date, meeting_point, flyer_url, images")
        .in("id", albumAgendaIds)
        .order("date", { ascending: false }),
    ]);
    if (documentsError) throw documentsError;
    if (agendasError) throw agendasError;

    const metadataByAgenda = new Map(
      (albumDocuments || []).map((document) => [
        String(document.document_key).replace(/^album:/, ""),
        document,
      ]),
    );
    const countsByAgenda = new Map<string, AlbumCounts>();
    for (const row of albumRows || []) {
      const agendaId = String(row.agenda_id);
      const counts = countsByAgenda.get(agendaId) || emptyCounts();
      const video = isVideoMedia(row.aws_key, row.aws_url);
      const faces = faceCount(row.aws_face_id);
      counts.total += 1;
      if (video) {
        counts.videos += 1;
        counts.publicMedia += 1;
      } else if (faces === 0) {
        counts.landscapes += 1;
        counts.publicMedia += 1;
      } else {
        counts.searchablePhotos += 1;
        if (faces >= 3) {
          counts.groups += 1;
          counts.publicMedia += 1;
        } else {
          counts.privatePortraits += 1;
        }
      }
      countsByAgenda.set(agendaId, counts);
    }

    const tours = (agendas || []).flatMap((agenda) => {
      const metadata = metadataByAgenda.get(String(agenda.id));
      if (!adminPreview && metadata?.published === false) return [];
      const structured = asRecord(metadata?.structured_content);
      const counts = countsByAgenda.get(String(agenda.id)) || emptyCounts();
      return [{
        id: agenda.id,
        title: agenda.title,
        date: agenda.date,
        meeting_point: agenda.meeting_point,
        album_title: metadata?.title || `Memórias de ${agenda.title}`,
        album_description: metadata?.content || "Fotos e momentos especiais desta aventura.",
        photographer: String(structured.photographer || "Equipe Mais Trilha Menos Estresse"),
        cover_url: String(structured.coverUrl || agenda.flyer_url || firstAgendaImage(agenda.images) || ""),
        published: metadata ? metadata.published !== false : true,
        media_count: counts.total,
        public_media_count: counts.publicMedia,
        searchable_photo_count: counts.searchablePhotos,
        landscape_count: counts.landscapes,
        group_count: counts.groups,
        private_portrait_count: counts.privatePortraits,
        video_count: counts.videos,
        face_search_available: counts.searchablePhotos > 0,
      }];
    });

    return NextResponse.json({ tours, admin_preview: adminPreview });
  } catch (error) {
    console.error("Erro ao buscar tours do álbum:", error);
    return NextResponse.json({ error: "Falha ao buscar álbuns" }, { status: 500 });
  }
}

function emptyCounts(): AlbumCounts {
  return { total: 0, publicMedia: 0, searchablePhotos: 0, landscapes: 0, groups: 0, privatePortraits: 0, videos: 0 };
}

function faceCount(value: unknown) {
  return String(value || "").split(",").filter((id) => id.trim()).length;
}

function isVideoMedia(key: unknown, url: unknown) {
  return /\.(mp4|mov|m4v)(?:\?|$)/i.test(String(key || url || ""));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstAgendaImage(value: unknown) {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.trim()) || null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.find((item) => typeof item === "string" && item.trim()) || null
      : value;
  } catch {
    return value;
  }
}
