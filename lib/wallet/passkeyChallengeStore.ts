import 'server-only';
import { cacheGet, cacheSet, cacheDel } from '@/lib/cache/redis';
import crypto from 'node:crypto';

/**
 * Short-lived WebAuthn challenge store. Challenges MUST be single-use
 * and bound to the user that requested them; Redis with a 5-minute TTL
 * matches the spec's recommendation and the @simplewebauthn defaults.
 *
 * Falls back to an in-process Map when Redis is not configured
 * (local dev) so the flow still works against a single node — never
 * use that path in production.
 */

const TTL_SECONDS = 5 * 60;
const fallback = new Map<string, { value: string; expiresAt: number }>();

function key(scope: 'reg' | 'auth', userId: string) {
  return `webauthn:${scope}:${userId}`;
}

export async function putChallenge(scope: 'reg' | 'auth', userId: string): Promise<string> {
  const challenge = crypto.randomBytes(32).toString('base64url');
  const k = key(scope, userId);
  try {
    await cacheSet(k, challenge, TTL_SECONDS);
  } catch {
    fallback.set(k, { value: challenge, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  }
  return challenge;
}

export async function takeChallenge(scope: 'reg' | 'auth', userId: string): Promise<string | null> {
  const k = key(scope, userId);
  let value: string | null = null;
  try {
    value = await cacheGet<string>(k);
    if (value) await cacheDel(k);
  } catch {
    /* fall through */
  }
  if (!value) {
    const f = fallback.get(k);
    if (f && f.expiresAt > Date.now()) value = f.value;
    fallback.delete(k);
  }
  return value;
}
