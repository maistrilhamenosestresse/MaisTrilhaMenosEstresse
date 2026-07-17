import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { runServerBackup } from '@/lib/server/backup';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const received = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!expected || !received || !safeEquals(received, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runServerBackup('vercel-cron');
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Falha no backup automático:', error);
    return NextResponse.json({ error: 'Falha no backup automático' }, { status: 500 });
  }
}

function safeEquals(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
