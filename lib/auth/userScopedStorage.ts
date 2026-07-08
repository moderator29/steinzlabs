// FIX 5A.1: was cross-account localStorage leak (Chrome showed previous user's wallet when another user signed in),
// now wipes all user-scoped keys on SIGNED_IN user-id change and on SIGNED_OUT.

const USER_ID_KEY = 'naka_current_user_id';

// SECURITY (cross-account isolation): every key here holds USER-SPECIFIC state
// under a GLOBAL (non-namespaced) storage key. On a shared browser these MUST be
// purged the instant the authenticated user changes (account switch) or signs
// out, or account B inherits account A's wallets / session keys / auth tokens /
// conversations / watchlists / profile. A prefix matches via String.startsWith,
// so 'steinz_alerts' also covers 'steinz_alert_history' etc.
//
// Design note: this is a DENYLIST (wipe these) guarded by PRESERVE_PREFIXES
// (keep these). When you add a NEW client cache that stores anything tied to the
// signed-in user, add its key/prefix here — otherwise it will leak across an
// on-device account switch. Device-level visual prefs go in PRESERVE_PREFIXES.
const STALE_KEY_PREFIXES = [
  'wallet_',
  'watchlist_',
  'bookmarks_',
  'preferences_',
  'vtx_',
  // Hyphenated VTX keys (vtx-ai-page-history, vtx-ai-chat-history,
  // vtx-ai-daily-usage) were NOT matched by the 'vtx_' prefix, so a
  // previous account's VTX chat history survived an on-device account
  // switch and rendered for the next user. Cover the hyphen form too.
  'vtx-',
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

  // ── P0: wallet/session SIGNING KEY material under global keys ──────────────
  // SniperWalletModal persists a session-key private key at
  // `naka_sniper_session_pk_<uid>_<chain>` in PLAINTEXT. It is a capped,
  // time-boxed spending key — leaving it after logout is residual key material
  // on a shared device, so wipe every naka_sniper_* key on switch/sign-out.
  'naka_sniper_',

  // ── Auth / session token RESIDUE (session bleed to the next account) ───────
  // `steinz-auth-token` stores the access_token AND refresh_token as plaintext
  // JSON; `steinz_has_session` is its presence flag. `steinz_session` (the
  // legacy custom-JWT cookie still honored by lib/auth/apiAuth.ts) is cleared
  // separately as a cookie in wipeUserScopedStorage(). Without these, user B
  // could recover user A's refresh token from a shared browser after A logs out.
  'steinz-auth-token',
  'steinz_has_session',
  'steinz_last_activity',

  // ── Wallet pointers / display state (address + holdings prefs) ─────────────
  'steinz_default_wallet',
  'steinz_custom_tokens',
  'steinz_hidden_tokens',
  'steinz_hide_small',
  'naka_seed_backed_up_',

  // ── User data caches (watchlists, bookmarks, profile, tier, proofs) ───────
  'steinz_watchlist',
  'steinz_bookmarks',
  'steinz_read_notifs',
  'steinz_avatar_url',
  'steinz_cover_url',
  'steinz_preferences',
  'steinz_privacy',
  'steinz_support_chat',
  'steinz_proof_event',
  'steinz_user_tier',
  'steinz_last_tab',
  'smart-money-',          // smart-money-watching / smart-money-prefs
  'naka_vtx_',             // naka_vtx_model (VtxAiTab model choice)
  'naka_dm_',              // naka_dm_receipts / naka_dm_sound
];

// Keys to preserve across user switches (device-level prefs, not user data).
// naka_appearance / naka_theme back the appearance system; they are device
// visual prefs, not user data, so a same-device account switch must keep them
// (the provider still rehydrates from the new user's server row on load).
const PRESERVE_PREFIXES = ['naka_appearance', 'naka_theme', 'steinz_theme', 'steinz_remember_me'];

function shouldWipe(key: string): boolean {
  if (PRESERVE_PREFIXES.some((p) => key.startsWith(p))) return false;
  return STALE_KEY_PREFIXES.some((p) => key.startsWith(p));
}

// Legacy custom-JWT auth cookie (issued by app/auth/callback, still honored as
// an auth fallback by lib/auth/apiAuth.ts). It is NOT an httpOnly sb-* cookie —
// it's set via document.cookie, so document.cookie can (and must) delete it on
// account switch / sign-out, otherwise account A's JWT keeps authenticating API
// calls after account B "signs in" on a shared browser.
function clearLegacySessionCookie(): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = 'steinz_session=; path=/; Max-Age=0; SameSite=Lax';
  } catch {
    /* cookie unavailable */
  }
}

export function wipeUserScopedStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (shouldWipe(key)) localStorage.removeItem(key);
    }
    sessionStorage.clear();
    clearLegacySessionCookie();
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
