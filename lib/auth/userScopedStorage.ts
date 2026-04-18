// FIX 5A.1: was cross-account localStorage leak (Chrome showed previous user's wallet when another user signed in),
// now wipes all user-scoped keys on SIGNED_IN user-id change and on SIGNED_OUT.

const USER_ID_KEY = 'naka_current_user_id';

const STALE_KEY_PREFIXES = [
  'wallet_',
  'watchlist_',
  'bookmarks_',
  'preferences_',
  'vtx_',
  'naka_wallet_',
  'naka_watchlist_',
  'naka_prefs_',
  'steinz_wallets',
  'steinz_active_wallet',
  'steinz_solana_pubkey',
  'steinz_user_id',
  'steinz_portfolio',
  'steinz_alerts',
  'steinz_alert_history',
  'steinz_notifications',
  'steinz_welcomed',
  'steinz_notif_prefs',
];

// Keys to preserve across user switches (device-level prefs, not user data)
const PRESERVE_PREFIXES = ['steinz_theme', 'steinz_remember_me'];

function shouldWipe(key: string): boolean {
  if (PRESERVE_PREFIXES.some((p) => key.startsWith(p))) return false;
  return STALE_KEY_PREFIXES.some((p) => key.startsWith(p));
}

export function wipeUserScopedStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (shouldWipe(key)) localStorage.removeItem(key);
    }
    sessionStorage.clear();
  } catch {
    /* storage unavailable */
  }

  // Clear in-memory wallet session key
  import('@/lib/wallet/walletSession')
    .then((m) => m.clearWalletSessionKey?.())
    .catch(() => {});
}

export function syncCurrentUser(userId: string | null): { switched: boolean } {
  if (typeof window === 'undefined') return { switched: false };
  try {
    const prev = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      if (prev) wipeUserScopedStorage();
      localStorage.removeItem(USER_ID_KEY);
      return { switched: !!prev };
    }
    if (prev && prev !== userId) {
      wipeUserScopedStorage();
      localStorage.setItem(USER_ID_KEY, userId);
      return { switched: true };
    }
    if (!prev) localStorage.setItem(USER_ID_KEY, userId);
    return { switched: false };
  } catch {
    return { switched: false };
  }
}
