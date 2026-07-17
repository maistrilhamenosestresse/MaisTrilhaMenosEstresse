import { NextResponse } from 'next/server';
import { s3Client, BUCKET_NAME } from '@/lib/aws';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAdminUser } from '@/lib/server/auth';
import { assertSameOrigin } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Envie uma imagem válida de até 8 MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const uniqueKey = `produtos/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
    
    const buffer = Buffer.from(await file.arrayBuffer());
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueKey,
      Body: buffer,
      ContentType: file.type,
      // ACL removido - bucket usa Block Public Access com bucket policy pública
    }));

    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${uniqueKey}`;
    
    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error('Erro no upload de produto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
