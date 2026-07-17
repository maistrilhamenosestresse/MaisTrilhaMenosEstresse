import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { s3Client, BUCKET_NAME } from '@/lib/aws';
import { requireAdminUser } from '@/lib/server/auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAdminEmails } from '@/lib/server/env';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const uploader = await requireUploadAdmin();
  if ('response' in uploader) return uploader.response;
  const parsed = await readJsonBody<{ filename?: string; contentType?: string; size?: number }>(request, 20_000);
  if (parsed.response) return parsed.response;

  const filename = String(parsed.data.filename || '');
  const contentType = String(parsed.data.contentType || '');
  const size = Number(parsed.data.size || 0);
  const isImage = IMAGE_TYPES.has(contentType);
  const isVideo = VIDEO_TYPES.has(contentType);
  if (!filename || (!isImage && !isVideo) || !Number.isInteger(size) || size <= 0) {
    return NextResponse.json({ error: 'Arquivo, tipo ou tamanho inválido' }, { status: 400 });
  }
  if ((isImage && size > MAX_IMAGE_SIZE) || (isVideo && size > MAX_VIDEO_SIZE)) {
    return NextResponse.json({ error: isImage ? 'Imagem acima de 15 MB' : 'Vídeo acima de 500 MB' }, { status: 413 });
  }

  const extension = extensionFor(contentType);
  const key = `media/${isImage ? 'images' : 'videos'}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    CacheControl: 'public, max-age=31536000, immutable',
    ServerSideEncryption: 'AES256',
    Metadata: { uploadedBy: uploader.identity.slice(0, 200) },
  });
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const region = process.env.AWS_REGION || 'us-east-1';
  return NextResponse.json({
    signedUrl,
    url: `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`,
    key,
    type: isImage ? 'image' : 'video',
    size,
  });
}

async function requireUploadAdmin(): Promise<{ identity: string } | { response: NextResponse }> {
  const supabaseAuth = await requireAdminUser();
  if (!supabaseAuth.response) return { identity: supabaseAuth.user.id };
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (email && getAdminEmails().includes(email)) return { identity: email };
  return { response: supabaseAuth.response };
}

function extensionFor(contentType: string) {
  return ({
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
    'video/mp4': 'mp4', 'video/quicktime': 'mov',
  } as Record<string, string>)[contentType];
}
