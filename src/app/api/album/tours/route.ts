import { NextResponse } from "next/server";
import { requireAuthenticatedUser, resolveAuthenticatedClient } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export async function GET(req: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (auth.response) return auth.response;

    const client = await resolveAuthenticatedClient(auth.user);
    if (!client) {
      return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();

    // Buscar reservas do cliente
    const { data: reservas, error: resError } = await supabase
      .from('reservas')
      .select('agenda_id')
      .eq('client_id', client.id)
      .eq('status_pagamento', 'pago');

    if (resError) throw resError;
    if (!reservas || reservas.length === 0) {
      return NextResponse.json({ tours: [] });
    }

    const agendaIds = [...new Set(reservas.map(r => r.agenda_id))];

    // Exibe somente trilhas que já possuem mídia no álbum. Reservas pagas sem
    // fotos continuam válidas, mas não poluem o seletor com álbuns vazios.
    const { data: albumRows, error: albumError } = await supabase
      .from('fotos_trilhas')
      .select('agenda_id')
      .in('agenda_id', agendaIds);
    if (albumError) throw albumError;
    const albumAgendaIds = [...new Set((albumRows || []).map(row => row.agenda_id).filter(Boolean))];
    if (!albumAgendaIds.length) return NextResponse.json({ tours: [] });

    const { data: albumDocuments, error: documentsError } = await supabase
      .from('content_documents')
      .select('document_key, title, content, structured_content, published')
      .in('document_key', albumAgendaIds.map(id => `album:${id}`));
    if (documentsError) throw documentsError;
    const metadataByAgenda = new Map(
      (albumDocuments || []).map(document => [
        String(document.document_key).replace(/^album:/, ''),
        document,
      ]),
    );
    const mediaCountByAgenda = new Map<string, number>();
    for (const row of albumRows || []) {
      const id = String(row.agenda_id);
      mediaCountByAgenda.set(id, (mediaCountByAgenda.get(id) || 0) + 1);
    }

    // Buscar as agendas dessas reservas
    const { data: agendas, error: agError } = await supabase
      .from('agendas')
      .select('id, title, date, image_url, image_aws_url')
      .in('id', albumAgendaIds)
      .order('date', { ascending: false });

    if (agError) throw agError;

    const tours = (agendas || []).flatMap((agenda) => {
      const metadata = metadataByAgenda.get(String(agenda.id));
      if (metadata && metadata.published === false) return [];
      const structured = metadata?.structured_content && typeof metadata.structured_content === 'object'
        ? metadata.structured_content as Record<string, unknown>
        : {};
      return [{
        ...agenda,
        album_title: metadata?.title || `Memórias de ${agenda.title}`,
        album_description: metadata?.content || 'Fotos e momentos especiais desta aventura.',
        photographer: String(structured.photographer || 'Equipe Mais Trilha Menos Estresse'),
        cover_url: String(structured.coverUrl || agenda.image_aws_url || agenda.image_url || ''),
        media_count: mediaCountByAgenda.get(String(agenda.id)) || 0,
      }];
    });

    return NextResponse.json({ tours });

  } catch (error: any) {
    console.error("Erro ao buscar tours do álbum:", error);
    return NextResponse.json({ error: 'Falha ao buscar álbuns' }, { status: 500 });
  }
}
