/**
 * Referral code generation + verification. Deterministic per user
 * (same user, same code) so emails / shares stay stable across
 * sessions. Pure, no IO. Caller is responsible for storage if it
 * wants to enforce uniqueness against the user table.
 *
 * Audit 5.4 / B.17: fresh primitive for the onboarding referral
 * loop.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const CODE_LENGTH = 8;

/**
 * Hash a string into a 32-bit integer (FNV-1a). Used to seed the
 * code generator deterministically off the user id.
 */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function generateReferralCode(userId: string, salt = 'naka-2026'): string {
  if (!userId) return '';
  const rand = rng(fnv1a(`${salt}|${userId}`));
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += ALPHABET.charAt(Math.floor(rand() * ALPHABET.length));
  }
  return out;
}

const VALID_CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export function isValidReferralCode(code: string | null | undefined): boolean {
  if (!code || typeof code !== 'string') return false;
  return VALID_CODE_RE.test(code.toUpperCase());
}

/**
 * Normalize a user-typed code (uppercase, strip dashes/spaces) so the
 * eventual lookup is consistent. Returns the cleaned code or null if
 * the input doesn't conform.
 */
export function normalizeReferralCode(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return isValidReferralCode(cleaned) ? cleaned : null;
}
