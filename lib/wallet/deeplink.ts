/**
 * Mobile wallet deep-link helpers. The previous code path duplicated
 * the same `metamask.app.link` / `phantom.app/ul/browse` URLs inline in
 * three places inside `lib/hooks/useWallet.ts` (lines 129, 147, 187).
 * Centralising both:
 *   1. avoids a future divergence where one path forgets to encode,
 *   2. lets us add Reown universal links later without touching callers.
 *
 * Usage on a phone with no extension:
 *
 *   import { openMetaMaskApp, openPhantomApp } from '@/lib/wallet/deeplink';
 *   openMetaMaskApp(); // navigates Safari → MetaMask via universal link
 *
 * The functions return the URL they navigated to so the caller can log
 * or assert in tests; if there's no `window`, they return null and do
 * nothing.
 */

import { isBrowser } from '@/lib/utils/detectDevice';

/**
 * Open the current dapp inside the MetaMask Mobile in-app browser.
 *
 * Universal-link form per MetaMask docs:
 *   https://metamask.app.link/dapp/{host}{pathname}{search}
 *
 * If MetaMask is installed, iOS/Android jump straight into the in-app
 * browser; if not, the App Store / Play Store opens.
 */
export function openMetaMaskApp(): string | null {
  if (!isBrowser()) return null;
  const target = `${window.location.host}${window.location.pathname}${window.location.search}`;
  const url = `https://metamask.app.link/dapp/${target}`;
  window.location.href = url;
  return url;
}

/**
 * Open the current page inside the Phantom Mobile in-app browser.
 *
 * Universal-link form per Phantom docs:
 *   https://phantom.app/ul/browse/{encoded full URL}
 */
export function openPhantomApp(): string | null {
  if (!isBrowser()) return null;
  const url = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`;
  window.location.href = url;
  return url;
}

/** Open MetaMask Mobile and ask it to handle a WalletConnect URI. */
export function openMetaMaskWcUri(wcUri: string): string | null {
  if (!isBrowser()) return null;
  const url = `https://metamask.app.link/wc?uri=${encodeURIComponent(wcUri)}`;
  window.location.href = url;
  return url;
}

/** Open Phantom Mobile and ask it to handle a WalletConnect URI. */
export function openPhantomWcUri(wcUri: string): string | null {
  if (!isBrowser()) return null;
  const url = `https://phantom.app/ul/v1/connect?app_url=${encodeURIComponent(window.location.origin)}&dapp_encryption_public_key=${encodeURIComponent(wcUri)}`;
  window.location.href = url;
  return url;
}
