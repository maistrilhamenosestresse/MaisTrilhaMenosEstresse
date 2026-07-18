import JSZip from "jszip";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME } from "@/lib/aws";
import { requireAgendaCustomer } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ agendaId: string }> },
) {
  const { agendaId } = await context.params;
  const auth = await requireAgendaCustomer(agendaId);
  if (auth.response) return auth.response;

  const { data, error } = await createSupabaseAdmin()
    .from("fotos_trilhas")
    .select("aws_key, aws_url, aws_face_id")
    .eq("agenda_id", agendaId)
    .limit(250);
  if (error) return Response.json({ error: "Não foi possível carregar o álbum" }, { status: 500 });

  const publicPhotos = (data || []).filter((photo) => {
    if (!photo.aws_face_id) return true;
    return photo.aws_face_id.split(",").filter((id: string) => id.trim()).length >= 3;
  });
  if (!publicPhotos.length) {
    return Response.json({ error: "O álbum ainda não possui fotos públicas" }, { status: 404 });
  }

  const zip = new JSZip();
  let included = 0;
  await Promise.all(publicPhotos.map(async (photo, index) => {
    try {
      let bytes: Uint8Array;
      if (photo.aws_key) {
        const object = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: photo.aws_key }));
        bytes = await object.Body!.transformToByteArray();
      } else {
        const response = await fetch(photo.aws_url);
        if (!response.ok) return;
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      const extension = String(photo.aws_key || photo.aws_url || "").match(/\.(png|webp|jpe?g)(?:\?|$)/i)?.[1] || "jpg";
      zip.file(`foto-${String(index + 1).padStart(3, "0")}.${extension}`, bytes);
      included += 1;
    } catch {
      // Uma mídia indisponível não impede o download das demais.
    }
  }));
  if (!included) return Response.json({ error: "Nenhuma foto pôde ser baixada" }, { status: 502 });

  const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return new Response(archive as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="album-mais-trilha-${agendaId}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
