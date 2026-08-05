import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DeleteFacesCommand } from "@aws-sdk/client-rekognition";
import { NextResponse } from "next/server";
import { BUCKET_NAME, rekognitionClient, s3Client } from "@/lib/aws";
import { requireAdminUser } from "@/lib/server/auth";
import { assertSameOrigin } from "@/lib/server/request";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const { photoId } = await context.params;
  if (!isUuid(photoId)) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: photo, error: findError } = await supabase
    .from("fotos_trilhas")
    .select("id, agenda_id, aws_key, aws_face_id")
    .eq("id", photoId)
    .maybeSingle();
  if (findError || !photo) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const cleanupWarnings: string[] = [];
  const faceIds = String(photo.aws_face_id || "").split(",").map((id) => id.trim()).filter(Boolean);
  if (faceIds.length) {
    try {
      await rekognitionClient.send(new DeleteFacesCommand({
        CollectionId: `trilha_${String(photo.agenda_id).replace(/-/g, "_")}`,
        FaceIds: faceIds,
      }));
    } catch (error) {
      console.warn("Não foi possível remover índices faciais do álbum:", error);
      cleanupWarnings.push("índice facial");
    }
  }
  if (photo.aws_key) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: photo.aws_key }));
    } catch (error) {
      console.warn("Não foi possível remover mídia do S3:", error);
      cleanupWarnings.push("arquivo da AWS");
    }
  }

  const { error: deleteError } = await supabase.from("fotos_trilhas").delete().eq("id", photoId);
  if (deleteError) {
    return NextResponse.json({ error: "Não foi possível remover o arquivo do álbum" }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email,
    action: "album.media_deleted",
    resource_type: "trail_album_media",
    resource_id: photoId,
    metadata: { agendaId: photo.agenda_id, cleanupWarnings },
  });

  return NextResponse.json({ success: true, cleanupWarnings });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
