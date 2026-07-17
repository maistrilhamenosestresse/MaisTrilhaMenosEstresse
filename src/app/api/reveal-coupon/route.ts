import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/server/supabase-admin';
import { assertSameOrigin, readJsonBody } from '@/lib/server/request';
import { enforceRateLimit } from '@/lib/server/rate-limit';

const CAMPAIGN_ID = 'treasure_hunt_maistrilha2';
const MAX_REDEMPTIONS = 2;
const COUPONS = ['MAISTRILHA-1', 'MAISTRILHA-2'];

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const rateLimit = await enforceRateLimit(request, 'coupon-reveal', 5, 3600);
  if (rateLimit) return rateLimit;
  const parsed = await readJsonBody<{ personName?: string }>(request, 10_000);
  if (parsed.response) return parsed.response;

  const personName = String(parsed.data.personName || 'Anônimo').trim().slice(0, 150);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const ipHash = createHash('sha256').update(`${process.env.RATE_LIMIT_SECRET || process.env.NEXTAUTH_SECRET}:${ip}`).digest('hex');
  const { data: coupon, error } = await createSupabaseAdmin().rpc('redeem_campaign_coupon', {
    p_campaign_id: CAMPAIGN_ID,
    p_max_redemptions: MAX_REDEMPTIONS,
    p_coupon_codes: COUPONS,
    p_person_name: personName || 'Anônimo',
    p_ip_hash: ipHash,
    p_user_agent: request.headers.get('user-agent') || 'unknown',
  });
  if (error) return NextResponse.json({ success: false, message: 'Erro ao processar cupom.' }, { status: 500 });
  if (!coupon) return NextResponse.json({ success: false, exhausted: true, message: 'Os cupons esgotaram!' });
  return NextResponse.json({ success: true, coupon_code: coupon });
}
