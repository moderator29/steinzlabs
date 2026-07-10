'use client';

/**
 * WalletConnect / AppKit health diagnostic (#21).
 *
 * The #1 cause of "the modal opens but no wallet can connect" is a
 * metadata-origin mismatch: WalletConnect's Verify API compares the
 * dapp's metadata.url against the origin the page is actually served
 * from AND the allow-list configured in the Reown dashboard. When they
 * disagree, every wallet silently disables "Open" / "Connect".
 *
 * buildMetadata() in appkit.ts already resolves metadata.url to the live
 * window origin, but the Reown-dashboard allow-list is configured
 * out-of-band (owner action), so a brand-new origin (preview deploy,
 * www vs apex, a new custom domain) still fails until it's added there.
 *
 * This module surfaces a structured, copy-pasteable snapshot so the
 * owner can confirm the fix is live and see exactly which origin needs
 * allow-listing — instead of guessing from a generic "couldn't connect".
 */

import { HAS_APPKIT, APPKIT_PROJECT_ID, getAppKit } from './appkit';

export interface WalletConnectHealth {
  /** Overall: ok = configured + initialized; warn = configured but unverifiable; error = misconfigured. */
  status: 'ok' | 'warn' | 'error';
  /** Is NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID set? Without it AppKit no-ops. */
  hasProjectId: boolean;
  /** Last 4 chars of the project id (for "is it the right project?" without leaking it). */
  projectIdTail: string | null;
  /** The origin this page is actually served from — must match metadata.url. */
  servedOrigin: string;
  /** The origin metadata.url resolves to (window origin on client). */
  metadataOrigin: string;
  /** True when servedOrigin === metadataOrigin (the common failure when they drift). */
  originMatches: boolean;
  /** Did createAppKit() actually produce an instance? */
  appKitInitialized: boolean;
  /** Human-readable lines explaining the state + next step. */
  notes: string[];
}

/**
 * Compute a WalletConnect health snapshot. Client-only (reads
 * window.location). Safe to call repeatedly — pure aside from reading
 * the live AppKit instance.
 */
export function getWalletConnectHealth(): WalletConnectHealth {
  const servedOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  // metadata.url resolves to the window origin on the client (see
  // buildMetadata in appkit.ts), falling back to NEXT_PUBLIC_SITE_URL.
  const envOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const metadataOrigin = (servedOrigin || envOrigin || 'https://nakalabs.xyz').replace(/\/$/, '');
  const originMatches = !!servedOrigin && servedOrigin.replace(/\/$/, '') === metadataOrigin;

  // getAppKit is idempotent and returns the live instance (or null when
  // unconfigured).
  let appKitInitialized = false;
  try {
    appKitInitialized = HAS_APPKIT && getAppKit() != null;
  } catch {
    appKitInitialized = false;
  }

  const projectIdTail = APPKIT_PROJECT_ID ? APPKIT_PROJECT_ID.slice(-4) : null;

  const notes: string[] = [];
  let status: WalletConnectHealth['status'] = 'ok';

  if (!HAS_APPKIT) {
    status = 'error';
    notes.push('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect is disabled. Add it to the environment and redeploy.');
  } else {
    notes.push(`WalletConnect project configured (…${projectIdTail}).`);
    if (!appKitInitialized) {
      status = 'warn';
      notes.push('AppKit has not initialized yet on this page. Open the connect modal once, or reload.');
    }
    if (!originMatches) {
      status = 'warn';
      notes.push(`Origin drift: page is served from "${servedOrigin}" but metadata resolves to "${metadataOrigin}".`);
    }
    notes.push(`Add this exact origin to the Reown dashboard allow-list if connect still fails: ${metadataOrigin}`);
  }

  return {
    status,
    hasProjectId: HAS_APPKIT,
    projectIdTail,
    servedOrigin,
    metadataOrigin,
    originMatches,
    appKitInitialized,
    notes,
  };
}
