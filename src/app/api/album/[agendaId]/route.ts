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
      .select('aws_key, aws_url, aws_face_id')
      .eq('agenda_id', agendaId);

    if (error) throw error;

    // Filter for public photos (0 faces or >= 3 faces)
    const publicPhotos = (data || []).filter(foto => {
      if (!foto.aws_face_id) return true; // Landscape (0 faces)
      const faceCount = foto.aws_face_id.split(',').filter((id: string) => id.trim() !== '').length;
      return faceCount >= 3; // Group (3+ faces)
    });

    const photosWithSignedUrls = await Promise.all(
      publicPhotos.map(async (foto) => {
        if (!foto.aws_key) return { aws_url: foto.aws_url };
        
        try {
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: foto.aws_key,
          });
          const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 * 24 }); // 24 hours
          return { aws_url: signedUrl };
        } catch (e) {
          return { aws_url: foto.aws_url };
        }
      })
    );

    return NextResponse.json({ photos: photosWithSignedUrls });
  } catch (error: any) {
    console.error("Erro ao buscar fotos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
