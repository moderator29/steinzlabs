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

// Stable metadata URL — DO NOT read window.location at module init.
// Doing so caused an SSR/CSR mismatch (server emitted nakalabs.xyz,
// client emitted whatever origin it was on, including preview URLs).
// Wallets show a "URL mismatch" warning when the metadata URL differs
// from the actual page origin, but a stable canonical URL is the
// correct choice for production deploys.
const metadata = {
  name: 'Naka Labs',
  description: 'Top-1% on-chain trading terminal',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nakalabs.xyz',
  icons: ['https://nakalabs.xyz/logo.png'],
};

// Build the wagmi adapter only when we have a real PROJECT_ID.
// Constructing WagmiAdapter with an empty projectId triggers a
// runtime warning AND emits a broken WalletConnect transport that
// blocks the modal forever. Audit §10.2 — guard at construction.
export const wagmiAdapter = HAS_APPKIT
  ? new WagmiAdapter({
      networks: [...APPKIT_EVM_NETWORKS],
      projectId: PROJECT_ID,
      ssr: true,
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
    metadata,
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
      '--w3m-accent': '#0A1EFF',
      '--w3m-border-radius-master': '4px',
    },
    // Default chain the modal opens to when the user hasn't picked
    // one. Mainnet is the safe pick for a multi-chain dapp.
    defaultNetwork: mainnet,
  });
  return _appKit;
}

export const APPKIT_PROJECT_ID = PROJECT_ID;
