import { NextResponse } from 'next/server';
import { s3Client, BUCKET_NAME } from '@/lib/aws';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAdminUser } from '@/lib/server/auth';
import { assertSameOrigin } from '@/lib/server/request';
import { enforceRateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
const PRODUCT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;
  const rateLimit = await enforceRateLimit(request, 'admin-product-image', 30, 3600);
  if (rateLimit) return rateLimit;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (!PRODUCT_IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Envie uma imagem válida de até 8 MB' }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const uniqueKey = `produtos/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
    
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedProductImageSignature(buffer, file.type)) {
      return NextResponse.json(
        { error: 'O conteúdo do arquivo não corresponde a uma imagem válida' },
        { status: 400 },
      );
    }
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueKey,
      Body: buffer,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000, immutable',
      ServerSideEncryption: 'AES256',
      // ACL removido - bucket usa Block Public Access com bucket policy pública
    }));

    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${uniqueKey}`;
    
    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error('Erro no upload de produto:', error);
    return NextResponse.json({ error: 'Falha ao enviar a imagem do produto' }, { status: 500 });
  }
}

function hasExpectedProductImageSignature(buffer: Buffer, contentType: string) {
  if (contentType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return contentType === 'image/webp'
    && buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}
