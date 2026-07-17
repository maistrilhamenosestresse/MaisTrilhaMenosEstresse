import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { s3Client, BUCKET_NAME } from '@/lib/aws';
import { requireAdminUser, requireAuthenticatedUser } from '@/lib/server/auth';
import { getAdminEmails } from '@/lib/server/env';
import { assertSameOrigin } from '@/lib/server/request';
import { enforceRateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

const FOLDER_RULES = {
  'cadastro-docs': { prefix: 'cadastro-docs', auth: 'same-origin' },
  signatures: { prefix: 'signatures', auth: 'same-origin' },
  'app-profiles': { prefix: 'app-profiles', auth: 'user' },
  'media-images': { prefix: `media/images/${new Date().toISOString().slice(0, 10)}`, auth: 'admin' },
} as const;

type UploadFolder = keyof typeof FOLDER_RULES;

export async function POST(request: Request) {
  try {
    const originError = assertSameOrigin(request);
    if (originError) return originError;

    const rateLimit = await enforceRateLimit(request, 'server-image-upload', 30, 3600);
    if (rateLimit) return rateLimit;

    const formData = await request.formData();
    const file = formData.get('file');
    const folderValue = String(formData.get('folder') || '');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 });
    }
    if (!isUploadFolder(folderValue)) {
      return NextResponse.json({ error: 'Destino de upload nao permitido' }, { status: 400 });
    }

    const rule = FOLDER_RULES[folderValue];
    const authError = await authorizeFolder(rule.auth);
    if (authError) return authError;

    if (!IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Envie uma imagem valida de ate 15 MB' }, { status: 400 });
    }

    const extension = extensionFor(file.type);
    const key = `${rule.prefix}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000, immutable',
      ServerSideEncryption: 'AES256',
    }));

    const region = process.env.AWS_REGION || 'us-east-1';
    const publicUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({
      publicUrl,
      url: publicUrl,
      key,
      type: 'image',
      size: file.size,
    });
  } catch (error: any) {
    console.error('Erro no upload de imagem para AWS:', error);
    return NextResponse.json({ error: error.message || 'Falha ao enviar imagem para AWS' }, { status: 500 });
  }
}

async function authorizeFolder(auth: 'same-origin' | 'user' | 'admin') {
  if (auth === 'same-origin') return null;
  if (auth === 'user') {
    const authResult = await requireAuthenticatedUser();
    return authResult.response || null;
  }

  const adminResult = await requireAdminUser();
  if (!adminResult.response) return null;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (email && getAdminEmails().includes(email)) return null;
  return adminResult.response;
}

function isUploadFolder(folder: string): folder is UploadFolder {
  return folder in FOLDER_RULES;
}

function extensionFor(contentType: string) {
  return ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  } as Record<string, string>)[contentType] || 'jpg';
}
