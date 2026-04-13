'use client';

import { Landmark, RefreshCw, Copy } from 'lucide-react';
import { useState, useCallback } from 'react';
import { formatUSD, formatAddress } from '@/lib/formatters';

interface TreasuryWallet {
  chain: string;
  address: string;
  label: string;
  nativeBalance: number;
  nativeSymbol: string;
  nativePriceUsd: number;
  usdcBalance: number;
  totalUsd: number;
}

const MOCK_WALLETS: TreasuryWallet[] = [
  { chain: 'Ethereum', address: '0x1234567890abcdef1234567890abcdef12345678', label: 'Main Treasury', nativeBalance: 12.4,   nativeSymbol: 'ETH',  nativePriceUsd: 3200, usdcBalance: 24800, totalUsd: 64480 },
  { chain: 'Solana',   address: '8UoB5F3N1234567890abcdefGHIJKLMNOPQRSTUVW',  label: 'SOL Operations', nativeBalance: 420,    nativeSymbol: 'SOL',  nativePriceUsd: 180,  usdcBalance: 8200,  totalUsd: 83800 },
  { chain: 'Base',     address: '0xabcdef1234567890abcdef1234567890abcdef12', label: 'Base Fees',     nativeBalance: 2.1,    nativeSymbol: 'ETH',  nativePriceUsd: 3200, usdcBalance: 5600,  totalUsd: 12320 },
  { chain: 'Arbitrum', address: '0x9876543210fedcba9876543210fedcba98765432', label: 'ARB Ops',       nativeBalance: 1.8,    nativeSymbol: 'ETH',  nativePriceUsd: 3200, usdcBalance: 3100,  totalUsd: 8860 },
  { chain: 'BSC',      address: '0xfedcba9876543210fedcba9876543210fedcba98', label: 'BSC Fees',      nativeBalance: 24.5,   nativeSymbol: 'BNB',  nativePriceUsd: 580,  usdcBalance: 1200,  totalUsd: 15410 },
];

export default function TreasuryPage() {
  const [copied, setCopied] = useState('');

  const copy = useCallback((addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied(''), 1500);
    });
  }, []);

  const totalTreasury = MOCK_WALLETS.reduce((s, w) => s + w.totalUsd, 0);
  const totalUsdc = MOCK_WALLETS.reduce((s, w) => s + w.usdcBalance, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Treasury</h1>
          <p className="text-xs text-gray-500 mt-0.5">Multi-chain treasury wallet balances</p>
        </div>
        <button className="flex items-center gap-2 text-xs border border-[#1E2433] text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:border-[#2E3443] transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Treasury Value', value: formatUSD(totalTreasury) },
          { label: 'USDC / Stablecoins', value: formatUSD(totalUsdc) },
          { label: 'Active Chains', value: MOCK_WALLETS.length.toString() },
        ].map(k => (
          <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {MOCK_WALLETS.map(w => (
          <div key={w.address} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0A1EFF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Landmark className="w-5 h-5 text-[#0A1EFF]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white">{w.label}</span>
                    <span className="text-[10px] bg-[#1E2433] text-gray-400 px-2 py-0.5 rounded font-mono">{w.chain}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-gray-400">{formatAddress(w.address)}</span>
                    <button onClick={() => copy(w.address)} className="text-gray-600 hover:text-gray-300 transition-colors">
                      <Copy className="w-3 h-3" />
                    </button>
                    {copied === w.address && <span className="text-[10px] text-green-400">Copied!</span>}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-white">{formatUSD(w.totalUsd)}</div>
                <div className="text-xs text-gray-400">Total value</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#1E2433] grid grid-cols-3 gap-4 text-center text-xs">
              <div>
                <div className="text-gray-500 mb-0.5">{w.nativeSymbol} Balance</div>
                <div className="text-white font-mono font-medium">{w.nativeBalance.toFixed(4)} {w.nativeSymbol}</div>
                <div className="text-gray-600">{formatUSD(w.nativeBalance * w.nativePriceUsd)}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">USDC Balance</div>
                <div className="text-white font-mono font-medium">{w.usdcBalance.toLocaleString()} USDC</div>
                <div className="text-gray-600">{formatUSD(w.usdcBalance)}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">% of Treasury</div>
                <div className="text-[#0A1EFF] font-bold">{(w.totalUsd / totalTreasury * 100).toFixed(1)}%</div>
                <div className="flex justify-center mt-1">
                  <div className="w-20 bg-[#0A0E1A] rounded-full h-1">
                    <div className="bg-[#0A1EFF] h-1 rounded-full" style={{ width: `${(w.totalUsd / totalTreasury * 100).toFixed(0)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
