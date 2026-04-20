'use client';

import { useState, useEffect } from 'react';
import { Wallet, ArrowDown, ArrowUp, Camera, RotateCcw, ExternalLink, Plus, Key } from 'lucide-react';
import { useWallet } from '@/lib/hooks/useWallet';
import { useRouter } from 'next/navigation';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: number;
  change24h: number;
  icon: string;
}

export default function WalletTab() {
  const { address: walletAddress, shortAddress, provider, isConnected, connectAuto, connecting } = useWallet();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      fetchBalances(walletAddress);
    } else {
      setBalances([]);
      setTotalBalance(0);
    }
  }, [walletAddress]);

  const fetchBalances = async (address: string) => {
    setLoading(true);
    try {
      // 8s ceiling — on-chain RPC + token price enrichment can crawl on a cold
      // start; without this the wallet card would spin forever on slow chains.
      const response = await fetch(`/api/token-scanner?address=${address}`, {
        signal: AbortSignal.timeout(8_000),
        cache: 'no-store',
      });
      const data = await response.json();
      if (data.tokens && data.tokens.length > 0) {
        const tokens = data.tokens.map((t: any) => ({
          symbol: t.symbol || 'ETH',
          name: t.name || 'Ethereum',
          balance: t.balance || '0',
          valueUsd: t.valueUsd || 0,
          change24h: t.change24h || 0,
          icon: t.symbol?.charAt(0) || '?',
        }));
        setBalances(tokens);
        setTotalBalance(tokens.reduce((sum: number, t: TokenBalance) => sum + t.valueUsd, 0));
      }
    } catch (error) {

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
        <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center">
          <Wallet className="w-4 h-4 text-[#0A1EFF]" />
        </div>
        <div>
          <h2 className="text-base font-heading font-bold">Wallet</h2>
          <p className="text-[10px] text-gray-400">
            {shortAddress || 'Not connected'}
          </p>
        </div>
        {walletAddress && (
          <button onClick={() => fetchBalances(walletAddress)} className="ml-auto hover:bg-white/10 p-2 rounded-lg">
            <RotateCcw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="glass rounded-xl p-6 border border-white/10 text-center mb-4">
        <div className="text-xs text-gray-400 mb-1">Total Balance</div>
        <div className="text-3xl font-bold font-mono mb-4">
          ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="flex justify-center gap-6">
          {[
            { icon: ArrowDown, label: 'Receive' },
            { icon: ArrowUp, label: 'Send' },
            { icon: Camera, label: 'Scan' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.label} className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 border border-[#0A1EFF]/30 rounded-full flex items-center justify-center hover:bg-[#0A1EFF]/10 transition-colors">
                  <Icon className="w-4 h-4 text-[#0A1EFF]" />
                </div>
                <span className="text-[10px] text-gray-400">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {walletAddress && balances.length > 0 && (
        <div className="glass rounded-xl p-4 border border-white/10 mb-4">
          <h3 className="text-sm font-bold mb-3">Holdings</h3>
          <div className="space-y-2">
            {balances.map((token, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center text-xs font-bold">
                  {token.icon}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold">{token.symbol}</div>
                  <div className="text-[10px] text-gray-500">{token.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-semibold">${token.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  <div className="text-[10px] text-gray-500">{parseFloat(token.balance).toFixed(4)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {walletAddress && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 glass rounded-xl p-3 border border-white/10 text-xs text-gray-400 hover:text-[#0A1EFF] transition-colors mb-4"
        >
          View on {provider === 'phantom' ? 'Solscan' : 'Etherscan'} <ExternalLink className="w-3 h-3" />
        </a>
      )}

      <div className="glass rounded-xl p-4 border border-[#0A1EFF]/20 mb-4 bg-gradient-to-br from-[#0A1EFF]/5 to-[#7C3AED]/5">
        <div className="flex items-center gap-3 mb-2">
          <Key className="w-4 h-4 text-[#0A1EFF]" />
          <h3 className="text-xs font-bold">Naka Built-in Wallet</h3>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#0A1EFF]/20 text-[#0A1EFF]">NEW</span>
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
      className="w-full py-2 bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
    >
      <Plus className="w-3 h-3" /> Open Naka Wallet
    </button>
  );
}
