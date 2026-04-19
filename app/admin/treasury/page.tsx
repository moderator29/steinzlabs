'use client';

import { Landmark, RefreshCw, Copy, Loader2 } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
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

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function TreasuryPage() {
  const [wallets, setWallets] = useState<TreasuryWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  const loadWallets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/treasury', { headers: authHeader() });
      if (res.ok) {
        const json = await res.json();
        setWallets(json.wallets ?? []);
      }
    } catch (err) {
      console.error('[Treasury] Failed to load wallets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWallets(); }, [loadWallets]);

  const copy = useCallback((addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied(''), 1500);
    });
  }, []);

  const totalTreasury = wallets.reduce((s, w) => s + w.totalUsd, 0);
  const totalUsdc = wallets.reduce((s, w) => s + w.usdcBalance, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Treasury</h1>
          <p className="text-xs text-gray-500 mt-0.5">Multi-chain treasury wallet balances</p>
        </div>
        <button
          onClick={loadWallets}
          disabled={loading}
          className="flex items-center gap-2 text-xs border border-[#1E2433] text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:border-[#2E3443] transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        {[
          { label: 'Total Treasury Value', value: formatUSD(totalTreasury) },
          { label: 'USDC / Stablecoins',  value: formatUSD(totalUsdc) },
          { label: 'Active Chains',        value: wallets.length.toString() },
        ].map(k => (
          <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading treasury wallets…</span>
        </div>
      )}

      {!loading && wallets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
          <Landmark className="w-8 h-8 text-gray-600" />
          <p className="text-sm">No treasury wallets configured.</p>
          <p className="text-xs text-gray-600">Configure treasury wallets in Platform Settings.</p>
        </div>
      )}

      {!loading && wallets.length > 0 && (
        <div className="space-y-3">
          {wallets.map(w => (
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
                  <div className="text-[#0A1EFF] font-bold">
                    {totalTreasury > 0 ? (w.totalUsd / totalTreasury * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div className="flex justify-center mt-1">
                    <div className="w-20 bg-[#0A0E1A] rounded-full h-1">
                      <div
                        className="bg-[#0A1EFF] h-1 rounded-full"
                        style={{ width: `${totalTreasury > 0 ? (w.totalUsd / totalTreasury * 100).toFixed(0) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
