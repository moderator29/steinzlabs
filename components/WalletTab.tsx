'use client';

import { useState, useEffect } from 'react';
import { Wallet, ArrowDown, ArrowUp, Camera, Plus, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: number;
  change24h: number;
  icon: string;
}

export default function WalletTab() {
  const { user } = useAuth();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('wallet_address');
    if (stored) {
      setWalletAddress(stored);
      fetchBalances(stored);
    }
  }, []);

  const fetchBalances = async (address: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/token-scanner?address=${address}`);
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
      console.error('Failed to fetch wallet balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof (window as any).ethereum === 'undefined') {
        alert('Please install MetaMask to connect your wallet');
        return;
      }

      const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts'
      });

      const address = accounts[0];
      localStorage.setItem('wallet_address', address);
      setWalletAddress(address);
      fetchBalances(address);
    } catch (error: any) {
      console.error('Wallet connect error:', error);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center">
          <Wallet className="w-4 h-4 text-[#00E5FF]" />
        </div>
        <div>
          <h2 className="text-base font-heading font-bold">Wallet</h2>
          <p className="text-[10px] text-gray-400">
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
          </p>
        </div>
        {walletAddress && (
          <button onClick={() => fetchBalances(walletAddress)} className="ml-auto hover:bg-white/10 p-2 rounded-lg">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
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
                <div className="w-10 h-10 border border-[#00E5FF]/30 rounded-full flex items-center justify-center hover:bg-[#00E5FF]/10 transition-colors">
                  <Icon className="w-4 h-4 text-[#00E5FF]" />
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
                <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center text-xs font-bold">
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
          href={`https://etherscan.io/address/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 glass rounded-xl p-3 border border-white/10 text-xs text-gray-400 hover:text-[#00E5FF] transition-colors mb-4"
        >
          View on Etherscan <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {!walletAddress && (
        <div className="glass rounded-xl p-6 border border-white/10 text-center bg-gradient-to-b from-[#00E5FF]/5 to-transparent">
          <div className="w-10 h-10 bg-[#1A2235] rounded-full flex items-center justify-center mx-auto mb-3">
            <Plus className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-heading font-bold mb-1">Connect Your Wallet</h3>
          <p className="text-gray-400 text-xs mb-4 leading-relaxed">
            Link your Web3 wallet to track your portfolio and participate in predictions
          </p>
          <button
            onClick={connectWallet}
            className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-2.5 rounded-xl text-sm font-semibold hover:scale-105 transition-transform"
          >
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );
}
