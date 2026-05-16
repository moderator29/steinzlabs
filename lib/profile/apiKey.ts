/**
 * Personal API key generator + scope/permission helpers. Keys take
 * the shape:
 *
 *   nk_live_<28 chars>   production
 *   nk_test_<28 chars>   test / sandbox
 *
 * The prefix is intentional so we can detect leaked keys in
 * GitHub push-protection scans. The 28-char body is URL-safe base64
 * of 21 random bytes (168 bits of entropy).
 *
 * Audit §B.6 profile P1 — API keys with scopes.
 */

import 'server-only';
import { createHash, randomBytes } from 'crypto';

export type ApiKeyEnv = 'live' | 'test';

export type ApiKeyScope =
  | 'read:portfolio'
  | 'read:whales'
  | 'read:alerts'
  | 'write:alerts'
  | 'read:sniper'
  | 'write:sniper'
  | 'read:profile';

export const ALL_SCOPES: ReadonlyArray<ApiKeyScope> = [
  'read:portfolio',
  'read:whales',
  'read:alerts',
  'write:alerts',
  'read:sniper',
  'write:sniper',
  'read:profile',
];

/**
 * Generate one fresh key. Returns the raw key (must be shown to the
 * user exactly once at creation time) AND the sha256 hash to store
 * in the DB. We never store the raw key — verification compares
 * hash(presented) === stored_hash.
 */
export function generateApiKey(env: ApiKeyEnv = 'live'): { key: string; hash: string; prefix: string } {
  const body = randomBytes(21).toString('base64url'); // 28 chars
  const key = `nk_${env}_${body}`;
  const hash = createHash('sha256').update(key).digest('hex');
  // The first 12 chars are safe to display in the UI ('nk_live_AbCd…')
  // so the user can identify the key without exposing the full secret.
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

/**
 * Constant-time comparison of two hashes. Avoids leaking key
 * material via timing.
 */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Hash a presented key for lookup against the stored hash column.
 */
export function hashApiKey(presented: string): string {
  return createHash('sha256').update(presented).digest('hex');
}

/**
 * Check whether the key's granted scopes include the requested
 * scope. Used at the API route layer.
 */
export function hasScope(granted: ApiKeyScope[], required: ApiKeyScope): boolean {
  return granted.includes(required);
}

/**
 * Validate user-supplied scope strings against the allow-list so we
 * never insert an unknown scope into the DB.
 */
export function sanitizeScopes(input: string[] | null | undefined): ApiKeyScope[] {
  if (!Array.isArray(input)) return [];
  const allow = new Set<string>(ALL_SCOPES);
  const out: ApiKeyScope[] = [];
  for (const s of input) {
    if (typeof s === 'string' && allow.has(s)) out.push(s as ApiKeyScope);
  }
  return Array.from(new Set(out));
}
