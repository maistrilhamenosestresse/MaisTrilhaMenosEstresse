import 'server-only';

import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { requireServerEnv } from '@/lib/server/env';

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowSeconds: number) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const identity = forwarded || request.headers.get('x-real-ip') || 'unknown';
  const secret = process.env.RATE_LIMIT_SECRET || process.env.NEXTAUTH_SECRET || requireServerEnv('CRON_SECRET');
  const rateKey = createHash('sha256').update(`${secret}:${scope}:${identity}`).digest('hex');
  const { data: allowed, error } = await createSupabaseAdmin().rpc('consume_api_rate_limit', {
    p_rate_key: rateKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('Falha no rate limit:', error.message);
    return NextResponse.json({ error: 'Serviço temporariamente indisponível' }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde e tente novamente.' }, {
      status: 429,
      headers: { 'Retry-After': String(windowSeconds) },
    });
  }
  return null;
}
