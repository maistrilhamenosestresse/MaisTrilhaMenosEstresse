import { NextResponse } from "next/server";
import { s3Client, BUCKET_NAME } from "@/lib/aws";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { requireAdminUser } from "@/lib/server/auth";
import { assertSameOrigin, readJsonBody } from "@/lib/server/request";

export async function POST(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const parsed = await readJsonBody<{ agendaId?: string; files?: Array<{ name?: string; type?: string; size?: number }> }>(req, 100_000);
    if (parsed.response) return parsed.response;
    const { agendaId, files } = parsed.data;

    if (!agendaId || !files || !Array.isArray(files)) {
      return NextResponse.json({ error: "Missing agendaId or files array" }, { status: 400 });
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
    if (files.length > 100 || files.some((file) => !allowedTypes.has(String(file.type || '')) || Number(file.size) <= 0 || Number(file.size) > 15 * 1024 * 1024)) {
      return NextResponse.json({ error: "São permitidas até 100 imagens de 15 MB por envio" }, { status: 400 });
    }

    const urls = [];

    // Gerar uma URL assinada para cada arquivo
    for (const file of files) {
      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' } as Record<string, string>)[file.type!];
      const uniqueFileName = `${crypto.randomUUID()}.${ext}`;
      const objectKey = `trilhas/${agendaId}/${uniqueFileName}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        ContentType: file.type,
        ContentLength: file.size,
        ServerSideEncryption: 'AES256',
        CacheControl: 'private, max-age=31536000, immutable',
      });

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${objectKey}`;

      urls.push({
        fileName: file.name,
        signedUrl,
        publicUrl,
        objectKey,
      });
    }

    return NextResponse.json({ urls });

  } catch (error: any) {
    console.error("Erro ao gerar presigned urls:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
