import { NextResponse } from "next/server";
import { rekognitionClient, BUCKET_NAME } from "@/lib/aws";
import { CreateCollectionCommand, IndexFacesCommand } from "@aws-sdk/client-rekognition";
import { requireAdminUser } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

export async function POST(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const parsed = await readJsonBody<{ agendaId?: string; objectKey?: string; publicUrl?: string }>(req, 50_000);
    if (parsed.response) return parsed.response;
    const { agendaId, objectKey, publicUrl } = parsed.data;

    if (!agendaId || !objectKey || !publicUrl) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const collectionId = `trilha_${agendaId.replace(/-/g, '_')}`;

    // 1. Tenta criar a Collection (se falhar porque já existe, tudo bem)
    try {
      await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }));
    } catch (e: any) {
      if (e.name !== 'ResourceAlreadyExistsException') {
        console.warn("Aviso ao criar collection:", e.message);
      }
    }

    // 2. Indexa a foto (encontra os rostos na foto do S3)
    const indexCommand = new IndexFacesCommand({
      CollectionId: collectionId,
      Image: {
        S3Object: {
          Bucket: BUCKET_NAME,
          Name: objectKey,
        },
      },
      ExternalImageId: objectKey.replace(/[^a-zA-Z0-9_.\-:]/g, '_').substring(0, 255), // sanitização exigida pela AWS
      MaxFaces: 10,
      QualityFilter: "AUTO",
      DetectionAttributes: ["DEFAULT"],
    });

    const indexRes = await rekognitionClient.send(indexCommand);

    // 3. Salva a foto no Supabase vinculando os FaceIds encontrados
    const faceIds = indexRes.FaceRecords?.map((f) => f.Face?.FaceId).filter(Boolean) || [];

    const { data: dbData, error: dbError } = await createSupabaseAdmin()
      .from('fotos_trilhas')
      .insert({
        agenda_id: agendaId,
        aws_url: publicUrl,
        aws_key: objectKey,
        aws_face_id: faceIds.join(','), // Salva todos os rostos encontrados nesta foto
      })
      .select('id')
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, dbId: dbData.id, facesIndexed: faceIds.length });

  } catch (error: any) {
    console.error("Erro no index-faces:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
