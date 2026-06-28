/**
 * Pure scope/cap enforcement for delegated session keys (24/7 auto-copy).
 * No I/O — the caller supplies the session-key row and the trailing-24h spend
 * (from session_key_spends) so this stays unit-testable and is the single gate
 * every auto-copy sign must pass. See docs/design/2026-06-28-session-key-auto-copy.md.
 */
import { normalizeAddress } from '@/lib/utils/addressNormalize';

export interface SessionKeyRow {
  id: string;
  chain: string;
  max_per_trade_usd: number | string;
  daily_cap_usd: number | string;
  allowed_tokens: string[] | null;
  expires_at: string;
  revoked_at: string | null;
}

export interface ProposedCopy {
  chain: string;
  tokenAddress: string;
  amountUsd: number;
}

export type ScopeVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Decide whether `proposed` is authorized by `key` given `spentTodayUsd` (sum of
 * session_key_spends in the trailing 24h). Fails closed on any bad/edge input.
 */
export function checkSessionScope(
  key: SessionKeyRow,
  proposed: ProposedCopy,
  spentTodayUsd: number,
  now: Date,
): ScopeVerdict {
  if (key.revoked_at) return { ok: false, reason: 'session key revoked' };
  if (new Date(key.expires_at).getTime() <= now.getTime()) return { ok: false, reason: 'session key expired' };

  if (normalizeAddress(key.chain) !== normalizeAddress(proposed.chain)) {
    return { ok: false, reason: 'chain not in session scope' };
  }

  const amount = Number(proposed.amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'non-positive amount' };

  const maxPer = Number(key.max_per_trade_usd);
  if (Number.isFinite(maxPer) && amount > maxPer) {
    return { ok: false, reason: `exceeds max per trade ($${maxPer})` };
  }

  const dailyCap = Number(key.daily_cap_usd);
  if (Number.isFinite(dailyCap) && spentTodayUsd + amount > dailyCap) {
    return { ok: false, reason: `would breach daily cap ($${dailyCap})` };
  }

  // allowed_tokens null/empty = any token within the caps; otherwise allowlist.
  if (key.allowed_tokens && key.allowed_tokens.length > 0) {
    const want = normalizeAddress(proposed.tokenAddress, proposed.chain);
    const ok = key.allowed_tokens.some((t) => normalizeAddress(t, proposed.chain) === want);
    if (!ok) return { ok: false, reason: 'token not in session allowlist' };
  }

  return { ok: true };
}
