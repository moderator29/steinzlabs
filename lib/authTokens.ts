import 'server-only';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Server-stored opaque auth tokens for password reset and email verify.
 *
 * Replaces the prior deterministic-HMAC pattern, which was:
 *   - Predictable: token = base64url(userId[0:8] + sha256(userId:email:reset:hour)[0:8])
 *     ~32 bits of entropy from the truncated HMAC, with a hour-bucketed
 *     keying scheme that gave a 2-hour validity window per token.
 *   - Brute-forceable: 32 bits ≈ 4 billion is feasible without per-user
 *     rate limit on the reset endpoint.
 *   - Replayable: HMAC over the same inputs always produces the same
 *     token within a given hour bucket.
 *   - Non-revocable: there was no DB row, so a stolen token couldn't
 *     be invalidated server-side.
 *
 * New design:
 *   - 32 random bytes from crypto.randomBytes (256 bits of entropy).
 *   - Token returned to caller as base64url; SHA-256 hash stored in DB.
 *     A DB compromise leaks hashes, not live tokens.
 *   - Single-use: marked consumed_at on first successful validation,
 *     rejecting any replay. Atomic UPDATE...RETURNING via the
 *     auth_tokens_consume() helper, so the check-and-mark race window
 *     is closed at the database level.
 *   - Explicit TTL: 30 minutes for reset, 24 hours for verify.
 *   - Existing unconsumed tokens of the same kind for the same user
 *     are invalidated when a new one is generated, so re-requesting a
 *     reset email cancels the previous link.
 *
 * The exported function signatures match the previous module so callers
 * don't need to change. validateResetToken still accepts (uid, email, token)
 * but email is no longer used in the verification path (it was only there
 * to bind the HMAC). It's kept in the signature for backwards compat.
 */

const RESET_TTL_MIN = 30;
const VERIFY_TTL_HOURS = 24;

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function newToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url');
  return { raw, hash: sha256Hex(raw) };
}

async function issueToken(userId: string, kind: 'reset' | 'verify', ttlMs: number): Promise<string> {
  const admin = getSupabaseAdmin();
  // Invalidate any previous unconsumed token of the same kind for this
  // user — if they request a second reset email, the first link stops
  // working immediately. Reduces the live-token surface.
  await admin
    .from('auth_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('kind', kind)
    .is('consumed_at', null);

  const { raw, hash } = newToken();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const { error } = await admin.from('auth_tokens').insert({
    user_id: userId,
    kind,
    token_hash: hash,
    expires_at: expiresAt,
  });
  if (error) {
    throw new Error(`[authTokens] failed to persist ${kind} token: ${error.message}`);
  }
  return raw;
}

async function consumeToken(userId: string, kind: 'reset' | 'verify', token: string): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  const hash = sha256Hex(token);
  const admin = getSupabaseAdmin();

  // Atomic check-and-consume: UPDATE only matches an unconsumed, unexpired
  // row; the RETURNING column tells us whether the update found a row.
  // A second request with the same token finds zero rows and returns false.
  const { data, error } = await admin
    .from('auth_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('token_hash', hash)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id');

  if (error) return false;
  return Array.isArray(data) && data.length === 1;
}

export async function generateVerifyToken(userId: string, _email: string): Promise<string> {
  void _email;
  return issueToken(userId, 'verify', VERIFY_TTL_HOURS * 60 * 60 * 1000);
}

export async function generateResetToken(userId: string, _email: string): Promise<string> {
  void _email;
  return issueToken(userId, 'reset', RESET_TTL_MIN * 60 * 1000);
}

export async function validateVerifyToken(userId: string, token: string): Promise<boolean> {
  return consumeToken(userId, 'verify', token);
}

export async function validateResetToken(userId: string, _email: string, token: string): Promise<boolean> {
  void _email;
  return consumeToken(userId, 'reset', token);
}
