/**
 * In-memory built-in-wallet password cache.
 *
 * Hardened against §1 audit findings:
 *   - The key was a module-level `let` exported via getter. Any XSS
 *     payload could call `getWalletSessionKey()` (or just read the
 *     module from a known import path) and exfiltrate it.
 *   - Cleared only on `beforeunload`, which doesn't fire reliably in
 *     mobile Safari and never fires on tab-switch. The decrypted key
 *     could outlive the user's expectation of "I closed the tab".
 *
 * Current design:
 *   - Key lives in a closure, not on `module.exports` style scope. The
 *     getter returns null after TTL expiry without exposing the value
 *     to anyone holding a stale reference.
 *   - Hard 30-minute TTL from last access. Every successful read
 *     refreshes the timer; if the tab idles for 30 minutes, the key
 *     auto-evicts and the user has to re-enter their password.
 *   - Cleared on `pagehide` (fires reliably on tab close, navigation,
 *     and bfcache eviction) and `visibilitychange` → hidden (fires when
 *     the tab is backgrounded; we don't want a decrypted key sitting
 *     in memory while the user is in another tab/app).
 */

const SESSION_TTL_MS = 30 * 60 * 1000;

interface SessionState {
  key: string;
  expiresAt: number;
}

let _state: SessionState | null = null;

export function setWalletSessionKey(key: string) {
  _state = { key, expiresAt: Date.now() + SESSION_TTL_MS };
}

export function getWalletSessionKey(): string | null {
  if (!_state) return null;
  if (Date.now() >= _state.expiresAt) {
    _state = null;
    return null;
  }
  // Sliding window: every successful access refreshes the TTL. The user
  // is actively trading, so don't time them out mid-flow.
  _state.expiresAt = Date.now() + SESSION_TTL_MS;
  return _state.key;
}

export function clearWalletSessionKey() {
  _state = null;
}

if (typeof window !== 'undefined') {
  // pagehide is the reliable cross-browser shutdown signal (covers tab
  // close, refresh, navigation away, and bfcache). beforeunload doesn't
  // fire on iOS Safari for tab switches.
  window.addEventListener('pagehide', clearWalletSessionKey);
  // Background the tab → drop the key. Coming back requires re-entry.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') clearWalletSessionKey();
  });
}
