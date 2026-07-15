/**
 * Client-safe formatters for the Coins surfaces. Memecoin prices span many
 * orders of magnitude, so price formatting uses subscript-zero notation for
 * tiny values. All functions return the null placeholder for missing data;
 * we never invent a number.
 */

const NULL = '—'; // placeholder only, per project rules

/** Compact USD: $423.4K, $19.7M, $1.2B, $2.34. */
export function compactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return NULL;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}

/** Compact number without a currency sign: 2,592 / 19.7M. */
export function compactNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return NULL;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

/**
 * Price formatter for coins. Prices >= $1 show 2-4 sig digits; tiny prices use
 * subscript-zero notation, e.g. 0.0₄423 for 0.0000423, so the row stays short.
 */
export function coinPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return NULL;
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.001) return `$${n.toFixed(4)}`;
  // Count leading zeros after the decimal point.
  const str = n.toFixed(20);
  const frac = str.split('.')[1] ?? '';
  let zeros = 0;
  while (frac[zeros] === '0') zeros++;
  const sig = frac.slice(zeros, zeros + 4).replace(/0+$/, '') || '0';
  return `$0.0${subscript(zeros)}${sig}`;
}

const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
function subscript(n: number): string {
  return String(n).split('').map((d) => SUB[Number(d)] ?? d).join('');
}

/** Signed percent: +14,377.36% / -30.65%. */
export function signedPct(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return NULL;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

/** Human hold duration: 11d 14h, 1d 5h, 11h 39m, 4m. */
export function holdTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return NULL;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Short relative time for trade rows: 39s, 2m, 3h, 5d. */
export function shortAgo(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return NULL;
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${Math.max(1, s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Short contract address: 0x1234...abcd or Solana base58 head/tail. */
export function formatAddress(addr: string | null | undefined, head = 4, tail = 4): string {
  if (!addr) return NULL;
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head + (addr.startsWith('0x') ? 2 : 0))}...${addr.slice(-tail)}`;
}

export const COIN_NULL = NULL;
