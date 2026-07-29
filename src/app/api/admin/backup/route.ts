import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { runServerBackup } from '@/lib/server/backup';
import { assertSameOrigin } from '@/lib/server/request';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const result = await runServerBackup(auth.user.email || auth.user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Falha no backup manual:', error);
    return NextResponse.json({ error: 'Falha no backup manual' }, { status: 500 });
  }
}
