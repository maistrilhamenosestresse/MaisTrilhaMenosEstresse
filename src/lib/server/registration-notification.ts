import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireServerEnv } from '@/lib/server/env';

export function signRegistrationNotification(clientId: string) {
  const secret = process.env.REGISTRATION_SIGNING_SECRET || requireServerEnv('NEXTAUTH_SECRET');
  return createHmac('sha256', secret)
    .update(`registration:${clientId}`)
    .digest('hex');
}

export function verifyRegistrationNotification(clientId: string, token: string) {
  const expected = Buffer.from(signRegistrationNotification(clientId), 'utf8');
  const received = Buffer.from(token || '', 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
