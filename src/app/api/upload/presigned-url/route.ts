import { NextResponse } from 'next/server';
import { s3Client, BUCKET_NAME } from '@/lib/aws';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { enforceRateLimit } from '@/lib/server/rate-limit';

// O Next.js não tem getServerSession com Supabase nativo, mas podemos verificar o token via header ou Supabase SSR.
// Para este escopo, se quisermos ser restritos, validaríamos o Supabase Auth.
// Por enquanto, geraremos o link seguro assumindo que a chamada partiu do App cliente autenticado.

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceRateLimit(request, 'public-presigned-upload', 20, 3600);
    if (rateLimit) return rateLimit;
    const originError = assertSameOrigin(request);
    if (originError) return originError;

    const parsed = await readJsonBody<{ filename?: string; contentType?: string; folder?: string; size?: number }>(request, 50_000);
    if (parsed.response) return parsed.response;
    const { filename, contentType, folder = 'uploads', size = 0 } = parsed.data;

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Filename e contentType são obrigatórios' }, { status: 400 });
    }

    const allowedFolders = new Set(['cadastro-docs', 'signatures', 'app-profiles']);
    if (!allowedFolders.has(folder) || !contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Tipo ou destino de upload não permitido' }, { status: 400 });
    }
    if (size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagem acima de 8 MB' }, { status: 413 });
    }
    if (folder === 'app-profiles') {
      const auth = await requireAuthenticatedUser();
      if (auth.response) return auth.response;
    }

    // Gerar um nome único
    const ext = filename.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const uniqueId = Math.random().toString(36).substring(2, 15);
    const key = `${folder || 'uploads'}/${Date.now()}_${uniqueId}.${ext}`;

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json({ error: 'Credenciais da AWS ausentes no servidor (AWS_ACCESS_KEY_ID ou AWS_SECRET_ACCESS_KEY).' }, { status: 500 });
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      // ACL removido - bucket usa Block Public Access com bucket policy pública
    });

    // O link presigned expira em 5 minutos (300 segundos)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // A URL pública onde a imagem ficará acessível (depende do CloudFront ou s3 domain)
    // Ex: https://maistrilha-menosestresse.s3.us-east-1.amazonaws.com/uploads/123_abc.jpg
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    return NextResponse.json({ signedUrl, publicUrl, key });
  } catch (error: any) {
    console.error('Erro ao gerar Presigned URL:', error);
    return NextResponse.json({ error: 'Erro ao gerar URL de upload', details: error.message }, { status: 500 });
  }
}
