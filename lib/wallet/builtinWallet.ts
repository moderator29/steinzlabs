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
  solanaAddress?: string;
  encryptedMnemonic?: string;
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
 * Resolve the built-in wallet's SOLANA address (base58). The built-in wallet
 * derives both an EVM and a Solana address from one seed; getBuiltinWalletAddress
 * returns the EVM one, but a Solana trade must be taken from the Solana address.
 * Matches the active wallet entry, else the first entry that has one. Returns
 * null when this wallet has no Solana address derived (older imports).
 */
export function getBuiltinSolanaAddress(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const wallets = readJson<StoredWalletLike[]>('steinz_wallets');
    if (!Array.isArray(wallets) || wallets.length === 0) return null;
    const activeEvm = getBuiltinWalletAddress();
    const match = activeEvm
      ? wallets.find((w) => w?.address && w.address.toLowerCase() === activeEvm.toLowerCase())
      : null;
    const sol = (match?.solanaAddress || wallets.find((w) => w?.solanaAddress)?.solanaAddress || '').trim();
    return sol || null;
  } catch {
    return null;
  }
}

/**
 * Restore the user's built-in wallet(s) from their cloud backup into
 * localStorage when this browser has none locally.
 *
 * Bug: the wallet PAGE cloud-hydrates from /api/wallet/sync when localStorage
 * is empty, but the swap / sniper / trading surfaces only read localStorage via
 * getBuiltinWalletAddress(). So on a fresh browser or a cleared session — where
 * the wallet genuinely exists in the user's cloud backup but not yet in this
 * browser — those surfaces wrongly re-prompt "create a wallet". This mirrors the
 * wallet page's reconcile step so any trading surface can restore the REAL
 * wallet without the user first having to open the wallet page.
 *
 * No-op (and cheap) when a wallet already exists locally. Returns the resolved
 * built-in address, or null when the cloud has none either (truly fresh user).
 */
export async function hydrateBuiltinWalletFromCloud(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  // Already have it locally — nothing to restore.
  const local = getBuiltinWalletAddress();
  if (local) return local;
  try {
    const res = await fetch('/api/wallet/sync', { credentials: 'include' });
    if (!res.ok) return null;
    const cloud = (await res.json()) as { wallets?: StoredWalletLike[]; defaultAddress?: string | null };
    const wallets = Array.isArray(cloud.wallets) ? cloud.wallets.filter((w) => w && typeof w.address === 'string' && w.address.trim()) : [];
    if (wallets.length === 0) return null;

    // Merge with anything already local (offline-create case) so we never drop
    // a locally-created wallet that hasn't synced up yet.
    const existing = readJson<StoredWalletLike[]>('steinz_wallets');
    const byAddr = new Map<string, StoredWalletLike>();
    for (const w of wallets) byAddr.set(w.address!.toLowerCase(), w);
    if (Array.isArray(existing)) {
      for (const w of existing) if (w?.address) byAddr.set(w.address.toLowerCase(), w);
    }
    const merged = Array.from(byAddr.values());
    localStorage.setItem('steinz_wallets', JSON.stringify(merged));

    const def = (cloud.defaultAddress && cloud.defaultAddress.trim()) || merged[0]?.address || '';
    if (def) {
      localStorage.setItem('steinz_default_wallet', def);
      setActiveBuiltinWallet(def);
    }
    return getBuiltinWalletAddress();
  } catch {
    // Cloud unreachable — leave local state as-is; the surface keeps its
    // honest "no wallet" prompt rather than inventing one.
    return null;
  }
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
