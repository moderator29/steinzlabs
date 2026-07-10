// Robinhood Chain → supported-chain bridge helper.
//
// Robinhood Chain (chain id 4663) is an Arbitrum Orbit L2 with native gas ETH.
// It has NO DEX aggregator coverage yet, so to trade users must first move
// their ETH to a chain that does (Ethereum, Base, …) and swap there.
//
// HONESTY / SAFETY POSTURE — read before extending this file:
//   • This is a GUIDED bridge, not a programmatic one. We deliberately do NOT
//     build or submit a canonical-bridge deposit/withdraw transaction here.
//     An Arbitrum Orbit chain withdraws through its own per-chain Inbox /
//     Bridge / Outbox contracts, and we could not verify Robinhood Chain's
//     canonical contract addresses to a standard high enough to encode calldata
//     that spends a user's funds. Fabricating a bridge address would be
//     reckless, so instead we route the user to the OFFICIAL bridge UI and
//     name the vetted fast-bridge alternatives from Robinhood's own docs.
//   • The only chain interaction we perform is a READ: eth_getBalance over a
//     public/Alchemy RPC to show the user's real Robinhood ETH balance. No
//     signing, no custody, no key access — fully non-custodial.
//   • Every URL below is a real, user-verifiable destination sourced from
//     Robinhood's bridging docs and the Arbitrum bridge portal. No invented
//     contracts, no invented routes.
//
// Sources:
//   https://docs.robinhood.com/chain/bridging/
//   https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain

import { getEvmRpcUrl } from '@/lib/chains/evmRpc';

/** Robinhood Chain mainnet EVM chain id. */
export const ROBINHOOD_CHAIN_ID = 4663;

/**
 * Canonical L2→L1 (Robinhood Chain → Ethereum) withdrawals inherit Arbitrum's
 * fraud-proof challenge window before the funds can be claimed on L1. This is a
 * hard protocol delay — never present the canonical path as instant.
 */
export const CANONICAL_WITHDRAWAL_CHALLENGE_DAYS = 7;

/**
 * Official, user-verifiable bridge destinations. Primary CTA is the canonical
 * Arbitrum bridge portal (pre-selected to Robinhood Chain); the docs link
 * explains deposit vs. withdraw mechanics and the challenge period.
 */
export const ROBINHOOD_BRIDGE = {
  /** Canonical Arbitrum bridge portal, pre-targeted at Robinhood Chain. */
  canonicalUrl: 'https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain',
  /** Robinhood's own bridging documentation (deposit/withdraw + delays). */
  docsUrl: 'https://docs.robinhood.com/chain/bridging/',
} as const;

/**
 * Vetted fast-bridge alternatives named in Robinhood Chain's bridging docs.
 * These are third-party liquidity bridges that settle in seconds–minutes
 * (they front the liquidity rather than waiting out the canonical challenge
 * window). We link to each provider's own UI — we never route through them
 * programmatically or hold funds.
 */
export interface FastBridgeOption {
  name: string;
  url: string;
  /** honest, provider-typical settlement window */
  eta: string;
}

export const ROBINHOOD_FAST_BRIDGES: FastBridgeOption[] = [
  { name: 'Across', url: 'https://across.to', eta: 'seconds–minutes' },
  { name: 'Jumper (LI.FI)', url: 'https://jumper.exchange', eta: 'seconds–minutes' },
  { name: 'Relay', url: 'https://relay.link', eta: 'seconds–minutes' },
];

/** Chains the app can swap on once the ETH has bridged off Robinhood Chain. */
export interface BridgeDestination {
  chainId: string;
  label: string;
  /** honest note about the route to this destination */
  note: string;
}

export const SWAP_DESTINATIONS: BridgeDestination[] = [
  { chainId: 'base', label: 'Base', note: 'Cheapest gas — recommended for most trades' },
  { chainId: 'ethereum', label: 'Ethereum', note: 'Deepest liquidity' },
];

export interface RobinhoodEthBalance {
  /** raw balance in wei */
  wei: bigint;
  /** balance as a human ETH number (18 decimals) */
  eth: number;
}

/**
 * Read the user's native ETH balance on Robinhood Chain via a plain
 * eth_getBalance RPC call. Read-only and non-custodial. Returns null on any
 * failure (bad address, RPC/CORS error) so callers degrade to the guided flow
 * without a balance rather than breaking — we never show a fabricated number.
 */
export async function getRobinhoodEthBalance(
  address: string,
): Promise<RobinhoodEthBalance | null> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  const rpcUrl = getEvmRpcUrl('robinhood');
  if (!rpcUrl) return null;
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string; error?: unknown };
    if (typeof data.result !== 'string' || !data.result.startsWith('0x')) return null;
    const wei = BigInt(data.result);
    // Convert to a Number for display only — precision loss at 1e-18 is
    // irrelevant for a UI balance readout; the on-chain value stays authoritative.
    const eth = Number(wei) / 1e18;
    return { wei, eth };
  } catch {
    return null;
  }
}

export interface BridgeStep {
  title: string;
  detail: string;
}

/**
 * The honest, ordered step list shown in the guided bridge card. Kept here (not
 * in the component) so the copy has one source of truth and stays consistent
 * with the constants above.
 */
export function getGuidedBridgeSteps(destinationLabel: string): BridgeStep[] {
  return [
    {
      title: 'Open the official bridge',
      detail:
        'You’ll leave to the canonical Arbitrum bridge portal, pre-selected to Robinhood Chain. Your wallet signs there — funds never leave your control.',
    },
    {
      title: `Move your ETH to ${destinationLabel}`,
      detail:
        `The canonical withdrawal to Ethereum settles after a ${CANONICAL_WITHDRAWAL_CHALLENGE_DAYS}-day challenge period (an Arbitrum fraud-proof rule). Fast third-party bridges can settle in minutes for a fee.`,
    },
    {
      title: 'Come back and swap',
      detail:
        `Once your ETH lands on ${destinationLabel}, return here and tap “Swap on ${destinationLabel}” — the trade routes through the live DEX aggregator.`,
    },
  ];
}
