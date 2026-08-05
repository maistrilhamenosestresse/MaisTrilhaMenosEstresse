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

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/x-m4v']);
    const invalidFile = files.find((file) => {
      const type = String(file.type || '');
      const size = Number(file.size);
      const limit = type.startsWith('image/') ? 20 * 1024 * 1024 : 500 * 1024 * 1024;
      return !allowedTypes.has(type) || size <= 0 || size > limit;
    });
    if (files.length > 100 || invalidFile) {
      return NextResponse.json({ error: "Envie até 100 arquivos. Fotos devem ser JPG/PNG (até 20 MB) e vídeos MP4/MOV (até 500 MB)." }, { status: 400 });
    }

    const urls = [];

    // Gerar uma URL assinada para cada arquivo
    for (const file of files) {
      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v' } as Record<string, string>)[file.type!] || file.name?.split('.').pop() || 'bin';
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
        contentType: file.type,
      });
    }

    return NextResponse.json({ urls });

  } catch (error: any) {
    console.error("Erro ao gerar presigned urls:", error);
    return NextResponse.json({ error: 'Não foi possível preparar o envio das fotos' }, { status: 500 });
  }
}
