'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Wallet, ArrowDown, ArrowUp, Camera, RotateCcw, ExternalLink, Plus, Key, ShoppingCart, Coins as CoinsIcon } from 'lucide-react';
import { useWallet } from '@/lib/hooks/useWallet';
import { useRouter } from 'next/navigation';
import { getOnrampUrl } from '@/lib/wallet/onramp';
import { isSolanaAddress } from '@/lib/utils/addressNormalize';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  balanceUi: number | null;
  contractAddress: string | null;
  decimals: number | null;
  icon: string;
}

interface BalancesResponse {
  chain: string;
  address: string;
  tokens: Array<{
    contract_address: string | null;
    symbol: string | null;
    name: string | null;
    decimals: number | null;
    balance: string;
    balance_ui: number | null;
    logo_url?: string | null;
    is_native?: boolean;
  }>;
}

export default function WalletTab() {
  const { address: walletAddress, shortAddress, provider, isConnected, connectAuto, connecting } = useWallet();
  const router = useRouter();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      fetchBalances(walletAddress);
    } else {
      setBalances([]);
    }
  }, [walletAddress, provider]);

  const fetchBalances = async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      // /api/wallet/balances is the canonical balance lister (Alchemy for EVM,
      // Helius for Solana). The old /api/token-scanner was a security scanner
      // we were misusing here — wrong shape, no USD enrichment.
      const chain = provider === 'phantom' ? 'solana' : 'ethereum';
      const response = await fetch(
        `/api/wallet/balances?address=${encodeURIComponent(address)}&chain=${chain}`,
        { signal: AbortSignal.timeout(10_000), cache: 'no-store' },
      );
      if (!response.ok) throw new Error(`balances ${response.status}`);
      const data = (await response.json()) as BalancesResponse;
      const tokens: TokenBalance[] = (data.tokens || [])
        .filter((t) => (t.balance_ui ?? 0) > 0 || t.is_native)
        .map((t) => ({
          symbol: t.symbol ?? '?',
          name: t.name ?? 'Unknown token',
          balance: t.balance,
          balanceUi: t.balance_ui,
          contractAddress: t.contract_address,
          decimals: t.decimals,
          icon: (t.symbol ?? '?').charAt(0).toUpperCase(),
        }));
      setBalances(tokens);
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'WalletTab', stage: 'fetch-balances' } });
      setError(err instanceof Error ? err.message : 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  };

  const explorerUrl = provider === 'phantom'
    ? `https://solscan.io/account/${walletAddress}`
    : `https://etherscan.io/address/${walletAddress}`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center">
          <Wallet className="w-4 h-4 text-[#0066FF]" />
        </div>
        <div>
          <h2 className="text-base font-heading font-bold">Wallet</h2>
          <p className="text-[10px] text-gray-400">
            {shortAddress || 'Not connected'}
          </p>
        </div>
        {walletAddress && (
          <button onClick={() => fetchBalances(walletAddress)} className="ms-auto hover:bg-white/10 p-2 rounded-lg">
            <RotateCcw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="glass rounded-xl p-6 border border-white/10 text-center mb-4">
        <div className="text-xs text-gray-300 mb-1">{balances.length} {balances.length === 1 ? 'token' : 'tokens'} held</div>
        <div className="text-sm text-gray-400 mb-4">
          Open the portfolio dashboard for live USD pricing and 24h moves.
        </div>
        <div className="flex justify-center gap-4 flex-wrap">
          {(() => {
            // Fund with card via the real on-ramp. Chain is derived from the
            // wallet address format so the provider always delivers to the
            // right network; falls back to the full wallet page otherwise.
            const buyChain = walletAddress && isSolanaAddress(walletAddress) ? 'solana' : 'ethereum';
            const buyUrl = walletAddress ? getOnrampUrl({ address: walletAddress, chain: buyChain }) : null;
            const actions: Array<{ icon: typeof ArrowDown; label: string; onClick?: () => void }> = [
              { icon: ShoppingCart, label: 'Buy', onClick: () => { if (buyUrl) window.open(buyUrl, '_blank', 'noopener,noreferrer'); else router.push('/dashboard/wallet-page'); } },
              { icon: CoinsIcon, label: 'Coins', onClick: () => router.push('/dashboard/coins') },
              { icon: ArrowDown, label: 'Receive' },
              { icon: ArrowUp, label: 'Send' },
              { icon: Camera, label: 'Scan' },
            ];
            return actions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label} type="button" onClick={action.onClick} className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 border border-[#0066FF]/30 rounded-full flex items-center justify-center hover:bg-[#0066FF]/10 transition-colors">
                    <Icon className="w-4 h-4 text-[#0066FF]" />
                  </div>
                  <span className="text-[10px] text-gray-400">{action.label}</span>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 mb-3 text-xs text-red-200">
          {error}
        </div>
      )}

      {walletAddress && balances.length > 0 && (
        <div className="glass rounded-xl p-4 border border-white/10 mb-4">
          <h3 className="text-sm font-bold mb-3">Holdings</h3>
          <div className="space-y-2">
            {balances.map((token, i) => (
              <div key={`${token.contractAddress ?? 'native'}-${i}`} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="w-8 h-8 bg-gradient-to-br from-[#0066FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center text-xs font-bold">
                  {token.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{token.symbol}</div>
                  <div className="text-[10px] text-gray-300 truncate">{token.name}</div>
                </div>
                <div className="text-end">
                  <div className="text-xs font-mono font-semibold">
                    {token.balanceUi !== null
                      ? token.balanceUi.toLocaleString(undefined, { maximumFractionDigits: 6 })
                      : Number(token.balance).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-300">{token.symbol}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {walletAddress && !loading && balances.length === 0 && !error && (
        <div className="glass rounded-xl p-4 border border-white/10 mb-4 text-center text-xs text-gray-300">
          No token balances detected for this address on {provider === 'phantom' ? 'Solana' : 'Ethereum'}.
        </div>
      )}

      {walletAddress && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 glass rounded-xl p-3 border border-white/10 text-xs text-gray-400 hover:text-[#0066FF] transition-colors mb-4"
        >
          View on {provider === 'phantom' ? 'Solscan' : 'Etherscan'} <ExternalLink className="w-3 h-3" />
        </a>
      )}

      <div className="glass rounded-xl p-4 border border-[#0066FF]/20 mb-4 bg-gradient-to-br from-[#0066FF]/5 to-[#7C3AED]/5">
        <div className="flex items-center gap-3 mb-2">
          <Key className="w-4 h-4 text-[#0066FF]" />
          <h3 className="text-xs font-bold">Naka Built-in Wallet</h3>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#0066FF]/20 text-[#0066FF]">NEW</span>
        </div>
        <p className="text-[10px] text-gray-400 mb-2">Create or import a non-custodial wallet. Your keys stay on your device.</p>
        <WalletPageButton />
      </div>

    </div>
  );
}

function WalletPageButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push('/dashboard/wallet-page')}
      className="w-full py-2 bg-gradient-to-r from-[#0066FF] to-[#7C3AED] rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
    >
      <Plus className="w-3 h-3" /> Open Naka Wallet
    </button>
  );
}
