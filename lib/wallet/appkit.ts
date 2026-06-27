/**
 * Reown AppKit (Web3Modal v5 successor) configuration.
 *
 * Why this file exists: §10 wires AppKit so MetaMask + Phantom work
 * over WalletConnect v2 on phones (the existing window.ethereum /
 * window.solana polling fails on mobile Safari + Chrome because the
 * extensions inject only after a deep-link return).
 *
 * Project ID is `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (already in
 * .env.local + prod env). If missing, AppKit no-ops gracefully — UI
 * still loads, "Connect Wallet" still works for the legacy extension
 * paths via lib/hooks/useWallet.ts. Don't crash on a missing key.
 *
 * IMPORTANT — non-custodial constraint (handoff §3):
 * AppKit only handles the CONNECT step. All signing still flows
 * through `lib/trading/builtinSigner.ts` / pending_trades. Don't
 * introduce server-side signing here.
 */

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import {
  mainnet,
  bsc,
  base,
  arbitrum,
  optimism,
  polygon,
  avalanche,
  solana,
} from '@reown/appkit/networks';

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

/** Public flag so call sites can conditionally render AppKit-dependent UI. */
export const HAS_APPKIT = PROJECT_ID.length > 0;

// Networks the swap surface supports today. Keep in sync with the
// CHAINS array in app/dashboard/swap/page.tsx — drift = chain switcher
// shows wallets a chain we can't actually quote.
export const APPKIT_EVM_NETWORKS = [mainnet, bsc, base, arbitrum, optimism, polygon, avalanche] as const;
export const APPKIT_NETWORKS = [...APPKIT_EVM_NETWORKS, solana] as const;

// WalletConnect Verify rejects (or wallets silently fail to complete the
// handshake) when metadata.url does not match the ACTUAL serving origin. The
// previous hardcoded canonical broke connect on www., preview, and any origin
// other than the literal env value. Since getAppKit() only ever runs in the
// browser (guarded below), resolve the real origin at call time and fall back
// to the canonical on the server. buildMetadata() is invoked inside getAppKit so
// the origin is read after hydration, never at module init (no SSR/CSR mismatch).
function buildMetadata() {
  // Pin to the CANONICAL origin so WalletConnect Verify always sees a single,
  // allow-listed domain (register this exact origin — and any www/preview you
  // test from — in the reown dashboard). Using the live window origin made
  // Verify fail on www/preview hosts that weren't allow-listed.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nakalabs.xyz').replace(/\/$/, '');
  return {
    name: 'Naka Labs',
    description: 'Top-1% on-chain trading terminal',
    url: origin,
    icons: [`${origin}/logo.png`],
  };
}

// Build the wagmi adapter only when we have a real PROJECT_ID.
// Constructing WagmiAdapter with an empty projectId triggers a
// runtime warning AND emits a broken WalletConnect transport that
// blocks the modal forever. Audit §10.2 — guard at construction.
export const wagmiAdapter = HAS_APPKIT
  ? new WagmiAdapter({
      networks: [...APPKIT_EVM_NETWORKS],
      projectId: PROJECT_ID,
      // ssr:false — the app is client-rendered and AppKit init is client-only.
      // ssr:true defers hydration to a server initialState (cookieStorage +
      // cookieToInitialState) that is NOT wired here, which dropped the in-flight
      // session on the mobile deep-link return.
      ssr: false,
    })
  : null;

export const solanaAdapter = HAS_APPKIT ? new SolanaAdapter() : null;

// `createAppKit` is idempotent inside this file — it returns the same
// instance on subsequent imports. We export the instance so callers
// can use the AppKit hooks (useAppKit, useAppKitAccount, etc.) from
// `@reown/appkit/react`.
let _appKit: ReturnType<typeof createAppKit> | null = null;

export function getAppKit() {
  if (_appKit) return _appKit;
  if (!HAS_APPKIT || !wagmiAdapter || !solanaAdapter) {
    // No project ID configured. Return null and let the caller fall
    // back to the legacy connect path (window.ethereum / window.solana).
    return null;
  }
  _appKit = createAppKit({
    adapters: [wagmiAdapter, solanaAdapter],
    networks: [...APPKIT_NETWORKS],
    projectId: PROJECT_ID,
    metadata: buildMetadata(),
    features: {
      // We use Supabase Auth for sign-in; don't double-prompt with
      // AppKit's email/social options on the wallet modal.
      email: false,
      socials: false,
      // Reown analytics (free, anonymous): toggle off if a privacy
      // review later flags it.
      analytics: true,
    },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#0066FF',
      '--w3m-border-radius-master': '4px',
    },
    // Default chain the modal opens to when the user hasn't picked
    // one. Mainnet is the safe pick for a multi-chain dapp.
    defaultNetwork: mainnet,
  });
  return _appKit;
}

export const APPKIT_PROJECT_ID = PROJECT_ID;

// Register the modal at module load ON THE CLIENT ONLY. appkit.ts is imported
// by the client WalletProviders, so this runs in the browser before React
// renders the tree — which means createAppKit has already run by the time any
// `useAppKit()` consumer (swap card, login, EnterNakaCult) renders. Previously
// init happened in a WalletProviders useEffect, which fires AFTER children
// render, so a consumer in the first-paint tree could hit Reown's
// "call createAppKit before using useAppKit" throw on the very first client
// render. The `typeof window` guard keeps SSR untouched (no window-at-import,
// no behaviour change on the server); getAppKit() is idempotent so the existing
// useEffect call remains a harmless safety net.
if (typeof window !== 'undefined' && HAS_APPKIT) {
  getAppKit();
}
