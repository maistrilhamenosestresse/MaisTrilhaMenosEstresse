import { NextResponse } from "next/server";
import { rekognitionClient } from "@/lib/aws";
import { SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";
import { requireAgendaCustomer } from "@/lib/server/auth";
import { createSupabaseAdmin } from "@/lib/server/supabase-admin";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

export async function POST(req: Request) {
  try {
    const originError = assertSameOrigin(req);
    if (originError) return originError;
    const parsed = await readJsonBody<{ agendaId?: string; imageBase64?: string }>(req, 12_100_000);
    if (parsed.response) return parsed.response;
    const { agendaId, imageBase64 } = parsed.data;

    if (!agendaId || !imageBase64) {
      return NextResponse.json({ error: "Missing agendaId or imageBase64" }, { status: 400 });
    }

    const auth = await requireAgendaCustomer(agendaId);
    if (auth.response) return auth.response;

    if (imageBase64.length > 12_000_000) {
      return NextResponse.json({ error: 'Imagem acima do limite permitido' }, { status: 413 });
    }

    const collectionId = `trilha_${agendaId.replace(/-/g, '_')}`;

    // Converte a imagem base64 para Buffer que a AWS entende
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Procura a selfie do usuário na coleção da trilha!
    const searchCommand = new SearchFacesByImageCommand({
      CollectionId: collectionId,
      Image: {
        Bytes: imageBuffer,
      },
      FaceMatchThreshold: 90, // Só retorna rostos com >90% de semelhança (precisão altíssima)
      MaxFaces: 100, // Limite máximo de match
    });

    const searchRes = await rekognitionClient.send(searchCommand);
    
    if (!searchRes.FaceMatches || searchRes.FaceMatches.length === 0) {
      return NextResponse.json({ matches: [] }); // Nenhuma foto encontrada
    }

    // Extrai os ExternalImageId (que salvamos como objectKey quando fizemos o upload)
    // Se o ExternalImageId for o objectKey, podemos buscar direto no Supabase.
    // E também temos o aws_face_id no Supabase, mas pela ExternalImageId é mais seguro!
    // Agora vamos buscar as URLs públicas originais no Supabase baseadas nessas keys
    // Como a ExternalImageId precisou ser sanitizada, vamos usar a busca pelo aws_key original que mapeia
    // Uma forma mais segura seria buscar pelo ID do Rosto (FaceId) que foi retornado:
    const matchedFaceIds = searchRes.FaceMatches
      .map(match => match.Face?.FaceId)
      .filter(Boolean) as string[];

    if (matchedFaceIds.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // A tabela fotos_trilhas tem aws_face_id como uma string separada por virgula "face1,face2"
    // Faremos um fetch de todas as fotos daquela agenda, e filtramos no JS (pois LIKE em arrays de string via Supabase JS pode ser complexo sem RPC).
    const { data: fotos, error } = await createSupabaseAdmin()
      .from('fotos_trilhas')
      .select('aws_url, aws_face_id, aws_key')
      .eq('agenda_id', agendaId);

    if (error) throw error;

    const matchedFotos = fotos?.filter(foto => {
      if (!foto.aws_face_id) return false;
      const faceIdsInPhoto = foto.aws_face_id.split(',');
      return matchedFaceIds.some(id => faceIdsInPhoto.includes(id));
    }) || [];

    const { s3Client, BUCKET_NAME } = await import("@/lib/aws");
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    const matchedUrls = await Promise.all(
      matchedFotos.map(async (foto) => {
        if (!foto.aws_key) return foto.aws_url;
        try {
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: foto.aws_key,
          });
          return await getSignedUrl(s3Client, command, { expiresIn: 3600 * 24 });
        } catch (e) {
          return foto.aws_url;
        }
      })
    );

    return NextResponse.json({ matches: matchedUrls });

  } catch (error: any) {
    // Se a coleção não existir, é porque ainda não enviaram fotos pra essa trilha
    if (error.name === 'ResourceNotFoundException') {
      return NextResponse.json({ matches: [] });
    }
    console.error("Erro no find-faces:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
