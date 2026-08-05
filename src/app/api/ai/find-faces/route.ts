import { NextResponse } from "next/server";
import { rekognitionClient } from "@/lib/aws";
import { DetectFacesCommand, SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";
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

    if (!imageBuffer.length || imageBuffer.length > 10_000_000) {
      return NextResponse.json({ error: "Selfie inválida ou acima de 10 MB" }, { status: 400 });
    }

    const detection = await rekognitionClient.send(new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ["DEFAULT"],
    }));
    const validFaces = (detection.FaceDetails || []).filter((face) => {
      const box = face.BoundingBox;
      const area = Number(box?.Width || 0) * Number(box?.Height || 0);
      return Number(face.Confidence || 0) >= 99 && area >= 0.035;
    });
    if (validFaces.length === 0) {
      return NextResponse.json({ error: "Nenhum rosto nítido foi detectado. Centralize o rosto e tente novamente." }, { status: 422 });
    }
    if (validFaces.length > 1) {
      return NextResponse.json({ error: "Use uma selfie individual, com apenas uma pessoa na imagem." }, { status: 422 });
    }

    const faceQuality = validFaces[0].Quality;
    if (Number(faceQuality?.Brightness || 0) < 25 || Number(faceQuality?.Sharpness || 0) < 20) {
      return NextResponse.json({ error: "A selfie está escura ou desfocada. Use uma iluminação melhor." }, { status: 422 });
    }

    // Primeiro busca com alta precisão. Se não houver resultado, amplia de forma
    // controlada a sensibilidade para fotos com ângulo, luz ou distância diferentes.
    let sensitivity: "precise" | "flexible" = "precise";
    let searchRes = await searchFaces(collectionId, imageBuffer, 96);
    if (!searchRes.FaceMatches?.length) {
      sensitivity = "flexible";
      searchRes = await searchFaces(collectionId, imageBuffer, 92);
    }
    
    if (!searchRes.FaceMatches || searchRes.FaceMatches.length === 0) {
      return NextResponse.json({ matches: [] }); // Nenhuma foto encontrada
    }

    // Extrai os ExternalImageId (que salvamos como objectKey quando fizemos o upload)
    // Se o ExternalImageId for o objectKey, podemos buscar direto no Supabase.
    // E também temos o aws_face_id no Supabase, mas pela ExternalImageId é mais seguro!
    // Agora vamos buscar as URLs públicas originais no Supabase baseadas nessas keys
    // Como a ExternalImageId precisou ser sanitizada, vamos usar a busca pelo aws_key original que mapeia
    // Uma forma mais segura seria buscar pelo ID do Rosto (FaceId) que foi retornado:
    const similarityByFaceId = new Map<string, number>();
    for (const match of searchRes.FaceMatches || []) {
      if (match.Face?.FaceId) similarityByFaceId.set(match.Face.FaceId, Number(match.Similarity || 0));
    }
    const matchedFaceIds = [...similarityByFaceId.keys()];

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

    const matchedFotos = (fotos || []).flatMap(foto => {
      if (!foto.aws_face_id) return [];
      const faceIdsInPhoto = foto.aws_face_id.split(',').map((id: string) => id.trim()).filter(Boolean);
      const similarities = faceIdsInPhoto
        .map((id: string) => similarityByFaceId.get(id))
        .filter((value: number | undefined): value is number => typeof value === "number");
      if (!similarities.length) return [];
      return [{ ...foto, similarity: Math.max(...similarities) }];
    }).sort((a, b) => b.similarity - a.similarity);

    const { s3Client, BUCKET_NAME } = await import("@/lib/aws");
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    const matchedUrls = await Promise.all(
      matchedFotos.map(async (foto) => {
        let url = foto.aws_url;
        try {
          if (foto.aws_key) {
            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: foto.aws_key,
            });
            url = await getSignedUrl(s3Client, command, { expiresIn: 3600 * 24 });
          }
        } catch {
          // Mantém a URL persistida como fallback.
        }
        return { url, similarity: Math.round(foto.similarity * 10) / 10 };
      })
    );

    return NextResponse.json({ matches: matchedUrls, sensitivity });

  } catch (error: any) {
    // Se a coleção não existir, é porque ainda não enviaram fotos pra essa trilha
    if (error.name === 'ResourceNotFoundException' || error.name === 'InvalidParameterException') {
      return NextResponse.json({ matches: [] });
    }
    console.error("Erro no find-faces:", error);
    return NextResponse.json({ error: 'Não foi possível localizar as fotos agora' }, { status: 500 });
  }
}

function searchFaces(collectionId: string, imageBuffer: Buffer, threshold: number) {
  return rekognitionClient.send(new SearchFacesByImageCommand({
    CollectionId: collectionId,
    Image: { Bytes: imageBuffer },
    FaceMatchThreshold: threshold,
    MaxFaces: 100,
  }));
}
