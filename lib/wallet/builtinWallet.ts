'use client';

/**
 * Canonical resolver for the Naka built-in wallet.
 *
 * Bug (batch 3, IMG_1933): the swap / sniper / whale / market-maker / view-proof
 * surfaces prompted "No Naka Wallet found — create or import a wallet" even when
 * the user had already created a built-in wallet. Root cause: those surfaces read
 * `steinz_active_wallet_address` (an orphan key that nothing ever wrote) and the
 * legacy `wallet_address` key (only set on a *successful* wallet-page balance
 * fetch). The real source of truth for the built-in wallet is
 * `steinz_wallets` (the array) + `steinz_default_wallet` (the chosen default).
 *
 * This module is the single place that knows how to read that source of truth,
 * so every trading surface auto-detects an existing built-in wallet instead of
 * re-prompting. It also mirrors the resolved address into
 * `steinz_active_wallet_address` so lib/wallet/pendingSigner.ts (which signs the
 * transaction) picks the same wallet.
 */

interface StoredWalletLike {
  address?: string;
  chain?: string;
  name?: string;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Resolve the address of the built-in wallet the user should be trading with.
 * Order of precedence:
 *   1. steinz_default_wallet     — the wallet the user marked default
 *   2. steinz_active_wallet_address — last active (already mirrored by us)
 *   3. steinz_wallets[0].address — first created wallet
 *   4. wallet_address (builtin)  — legacy key, only when provider is builtin
 * Returns null when no built-in wallet exists (external-only / fresh user).
 */
export function getBuiltinWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const def = localStorage.getItem('steinz_default_wallet');
    if (def && def.trim()) return def.trim();

    const active = localStorage.getItem('steinz_active_wallet_address');
    if (active && active.trim()) return active.trim();

    const wallets = readJson<StoredWalletLike[]>('steinz_wallets');
    if (Array.isArray(wallets)) {
      const first = wallets.find((w) => w && typeof w.address === 'string' && w.address.trim());
      if (first?.address) return first.address.trim();
    }

    // Legacy key — only trust it when it was written by the built-in wallet.
    const provider = localStorage.getItem('wallet_provider');
    const legacy = localStorage.getItem('wallet_address');
    if (provider === 'builtin' && legacy && legacy.trim()) return legacy.trim();

    return null;
  } catch {
    return null;
  }
}

/** True when a built-in Naka wallet exists in this browser. */
export function hasBuiltinWallet(): boolean {
  return getBuiltinWalletAddress() !== null;
}

/**
 * Mark an address as the active built-in wallet. Keeps
 * `steinz_active_wallet_address` (read by pendingSigner) in sync with whatever
 * the wallet page or a trading surface has selected, so signing never targets a
 * stale wallet.
 */
export function setActiveBuiltinWallet(address: string): void {
  if (typeof window === 'undefined' || !address) return;
  try {
    localStorage.setItem('steinz_active_wallet_address', address);
    window.dispatchEvent(new CustomEvent('steinz_wallet_changed'));
  } catch {
    // localStorage unavailable (private browsing) — signing will re-prompt.
  }
}
