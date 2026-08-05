import { NextResponse } from "next/server";
import { s3Client, BUCKET_NAME } from "@/lib/aws";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAgendaCustomer } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export async function GET(
  req: Request,
  context: { params: Promise<{ agendaId: string }> }
) {
  try {
    const { agendaId } = await context.params;

    if (!agendaId) {
      return NextResponse.json({ error: "Missing agendaId" }, { status: 400 });
    }

    const auth = await requireAgendaCustomer(agendaId);
    if (auth.response) return auth.response;

    const { data, error } = await createSupabaseAdmin()
      .from('fotos_trilhas')
      .select('id, aws_key, aws_url, aws_face_id, original_aws_key')
      .eq('agenda_id', agendaId);

    if (error) throw error;

    const stats = {
      total: 0,
      publicMedia: 0,
      searchablePhotos: 0,
      landscapes: 0,
      groups: 0,
      privatePortraits: 0,
      videos: 0,
    };
    const publicPhotos = (data || []).filter((photo) => {
      const video = isVideoMedia(photo.aws_key, photo.aws_url);
      const faces = String(photo.aws_face_id || '').split(',').filter((id: string) => id.trim()).length;
      stats.total += 1;
      if (video) {
        stats.videos += 1;
        stats.publicMedia += 1;
        return true;
      }
      if (faces === 0) {
        stats.landscapes += 1;
        stats.publicMedia += 1;
        return true;
      }
      stats.searchablePhotos += 1;
      if (faces >= 3) {
        stats.groups += 1;
        stats.publicMedia += 1;
        return true;
      }
      stats.privatePortraits += 1;
      return false;
    });

    const photosWithSignedUrls = await Promise.all(
      publicPhotos.map(async (foto) => {
        const mediaType = isVideoMedia(foto.aws_key, foto.aws_url) ? 'video' : 'image';
        if (!foto.aws_key) return { id: foto.id, aws_url: foto.aws_url, download_url: foto.aws_url, type: mediaType };
        
        try {
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: foto.aws_key,
          });
          const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 * 24 }); // 24 hours
          const downloadUrl = foto.original_aws_key
            ? await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: foto.original_aws_key }), { expiresIn: 3600 * 24 })
            : signedUrl;
          return { id: foto.id, aws_url: signedUrl, download_url: downloadUrl, type: mediaType };
        } catch {
          return { id: foto.id, aws_url: foto.aws_url, download_url: foto.aws_url, type: mediaType };
        }
      })
    );

    return NextResponse.json({
      photos: photosWithSignedUrls,
      stats,
      faceSearchAvailable: stats.searchablePhotos > 0,
    });
  } catch (error: any) {
    console.error("Erro ao buscar fotos:", error);
    return NextResponse.json({ error: 'Não foi possível carregar o álbum agora' }, { status: 500 });
  }
}

function isVideoMedia(key: unknown, url: unknown) {
  return /\.(mp4|mov|m4v)(?:\?|$)/i.test(String(key || url || ""));
}
