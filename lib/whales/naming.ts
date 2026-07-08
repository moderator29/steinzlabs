/**
 * Single source of truth for whale display names + avatar fallback across the
 * Whale Tracker, the Whale Directory and the Live Feed. Import from here — do
 * NOT re-implement per surface, or the numbering diverges and produces the
 * duplicates / mismatches the owner explicitly forbade.
 *
 * NAME RULES
 *   1. A whale with a real `label` keeps it.
 *   2. A whale with no label renders a stable "Naka Whale #N":
 *        - N is the whale's persisted `whales.naka_number` (a unique, permanent
 *          sequential id assigned by 2026_07_07_whales_naka_number.sql). Same
 *          wallet → same number on every surface and every reload; the DB
 *          UNIQUE index guarantees two wallets never share one.
 *        - For a wallet NOT in the whales table (ephemeral live-feed / on-the-fly
 *          discovery wallets that were never persisted) there is no naka_number,
 *          so we fall back to a deterministic hash of the normalized address.
 *          That hash lives in a HIGH, DISJOINT range so it can never collide
 *          with a real DB naka_number — and such wallets never appear in the
 *          directory, so no cross-surface mismatch is possible.
 *
 * This module is pure (no 'server-only' / 'use client') so both server routes
 * and client components can share it.
 */

import { normalizeAddress } from '@/lib/utils/addressNormalize';

/** Naka brand logo — the avatar shown for any whale with no real profile pic. */
export const NAKA_FALLBACK_AVATAR = '/logo.png';

// Hash-fallback numbers start here — far above any plausible DB naka_number, so
// a hashed (non-persisted) whale can never share a number with a persisted one.
// The whales table would need >1e9 rows to ever reach this floor.
const HASH_FALLBACK_FLOOR = 1_000_000_000;

// FNV-1a (32-bit): deterministic, well-distributed, identical in every JS
// runtime. Used only for wallets that have no persisted naka_number.
function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** True when a label is a real, non-empty name. */
export function hasRealLabel(label: string | null | undefined): boolean {
  return !!(label && label.trim());
}

/**
 * Stable Naka number for a wallet with no persisted `naka_number`. Pure function
 * of the normalized address, so the same wallet always resolves to the same
 * number. Lands in the disjoint high range so it never collides with a DB id.
 */
export function fallbackNakaNumber(address: string, chain?: string | null): number {
  const key = normalizeAddress(address ?? '', chain ?? undefined) || (address ?? '');
  return HASH_FALLBACK_FLOOR + fnv1a32(key);
}

/**
 * The canonical display name for a whale. Real label wins; otherwise
 * "Naka Whale #<naka_number>" using the persisted DB id when available, else the
 * address-derived fallback.
 */
export function whaleDisplayName(opts: {
  label?: string | null;
  nakaNumber?: number | null;
  address: string;
  chain?: string | null;
}): string {
  if (hasRealLabel(opts.label)) return opts.label!.trim();
  const n =
    opts.nakaNumber != null && Number.isFinite(opts.nakaNumber) && opts.nakaNumber > 0
      ? opts.nakaNumber
      : fallbackNakaNumber(opts.address, opts.chain);
  return `Naka Whale #${n}`;
}

// ─── Avatars ──────────────────────────────────────────────────────────────────

// Logo sources that represent a REAL profile picture. 'dicebear' is a synthetic
// identicon placeholder — the owner wants the Naka logo instead of an identicon
// for whales that have no real avatar.
const REAL_LOGO_SOURCES = new Set(['x', 'website', 'arkham', 'ens']);

/**
 * Whether a resolved logo is a REAL profile picture (worth showing) vs. a
 * synthetic placeholder we should replace with the Naka logo.
 */
export function isRealWhaleLogo(url?: string | null, source?: string | null): boolean {
  if (!url || !url.trim()) return false;
  if (/dicebear\.com/i.test(url)) return false; // synthetic identicon
  if (source) return REAL_LOGO_SOURCES.has(source.toLowerCase());
  // Unknown source but a concrete non-dicebear URL — treat as a real image.
  return /^https?:\/\//i.test(url.trim());
}

/** The avatar URL to render: a real logo when present, else the Naka logo. */
export function whaleAvatarSrc(url?: string | null, source?: string | null): string {
  return isRealWhaleLogo(url, source) ? url!.trim() : NAKA_FALLBACK_AVATAR;
}
