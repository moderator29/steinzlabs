'use client';

/**
 * ChainMismatchBanner — UI polish over the F1 mismatch guard.
 *
 * Original guard surfaced an amber banner asking the user to "switch
 * your wallet network" — but a 2025-class trading UX should one-click
 * the switch via wallet_switchEthereumChain (EIP-3326). Industry
 * parity: Uniswap, 1inch, Matcha all do this. If the chain isn't yet
 * added to the wallet, we fall back to wallet_addEthereumChain
 * (EIP-3085) using the canonical RPC + explorer URLs.
 *
 * Cross-family mismatch (Phantom on EVM / MetaMask on Solana) can't be
 * one-click resolved — different wallet entirely. For those we keep
 * the explainer copy.
 */

import { useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Loader2 } from 'lucide-react';

interface Props {
  crossFamilyMismatch: boolean;
  isPageSolana: boolean;
  provider: string | null;
  chain: string;
  walletPlatformChain: string | null;
}

interface ChainParams {
  chainId: string;        // hex
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: string[];
}

// Public RPC + explorer set per chain. Used for the
// wallet_addEthereumChain fallback when a network isn't yet added to
// the user's wallet. Public RPCs are intentionally chosen over keyed
// providers so the user retains control of their data path.
const SWITCH_PARAMS: Record<string, ChainParams> = {
  ethereum: {
    chainId: '0x1',
    chainName: 'Ethereum',
    rpcUrls: ['https://ethereum-rpc.publicnode.com'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://etherscan.io'],
  },
  base: {
    chainId: '0x2105',
    chainName: 'Base',
    rpcUrls: ['https://mainnet.base.org'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://basescan.org'],
  },
  arbitrum: {
    chainId: '0xa4b1',
    chainName: 'Arbitrum One',
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  optimism: {
    chainId: '0xa',
    chainName: 'OP Mainnet',
    rpcUrls: ['https://mainnet.optimism.io'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
  },
  polygon: {
    chainId: '0x89',
    chainName: 'Polygon',
    rpcUrls: ['https://polygon-rpc.com'],
    nativeCurrency: { name: 'Polygon Ecosystem Token', symbol: 'POL', decimals: 18 },
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  bsc: {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    rpcUrls: ['https://bsc-dataseed.bnbchain.org'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    blockExplorerUrls: ['https://bscscan.com'],
  },
  avalanche: {
    chainId: '0xa86a',
    chainName: 'Avalanche C-Chain',
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    blockExplorerUrls: ['https://snowtrace.io'],
  },
};

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export default function ChainMismatchBanner({
  crossFamilyMismatch,
  isPageSolana,
  provider,
  chain,
  walletPlatformChain,
}: Props) {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = SWITCH_PARAMS[chain];
  const canSwitch = !crossFamilyMismatch && !!params;

  const handleSwitch = async () => {
    if (typeof window === 'undefined' || !params) return;
    const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setError('Wallet provider not found. Open MetaMask and try again.');
      return;
    }
    setSwitching(true);
    setError(null);
    try {
      // EIP-3326 — try the switch first. If the chain isn't yet added
      // to the user's wallet (error 4902), fall through to EIP-3085.
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: params.chainId }],
      });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [params],
          });
        } catch (addErr) {
          setError(addErr instanceof Error ? addErr.message : 'Failed to add network.');
        }
      } else if (code === 4001) {
        setError('Network switch rejected.');
      } else {
        setError(err instanceof Error ? err.message : 'Switch failed.');
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 backdrop-blur-sm overflow-hidden">
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <div className="mt-0.5 w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={13} className="text-amber-300" />
        </div>
        <div className="min-w-0 flex-1 text-[11px] text-amber-100 leading-relaxed">
          {crossFamilyMismatch ? (
            <>
              <p className="font-semibold text-amber-200 mb-0.5">Wrong wallet family</p>
              Connected via <span className="font-semibold">{provider}</span>;
              this page trades on <span className="font-semibold uppercase">{chain}</span>.
              Connect {isPageSolana ? 'a Solana wallet (Phantom)' : 'an EVM wallet (MetaMask / Reown)'} to continue.
            </>
          ) : (
            <>
              <p className="font-semibold text-amber-200 mb-0.5">Network mismatch</p>
              Wallet is on <span className="font-semibold uppercase">{walletPlatformChain ?? 'an unknown network'}</span>;
              this page is <span className="font-semibold uppercase">{chain}</span>.
              {canSwitch && ' Tap to switch.'}
            </>
          )}
          {error && (
            <p className="mt-1.5 text-red-300 text-[10px]" role="alert">{error}</p>
          )}
        </div>
      </div>

      {canSwitch && (
        <button
          type="button"
          onClick={() => void handleSwitch()}
          disabled={switching}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border-t border-amber-500/30 text-amber-100 text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {switching ? (
            <><Loader2 size={12} className="animate-spin" /> Switching to {params.chainName}…</>
          ) : (
            <><ArrowRightLeft size={12} /> Switch to {params.chainName}</>
          )}
        </button>
      )}
    </div>
  );
}
