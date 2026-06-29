'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wallet, Search, ExternalLink } from 'lucide-react';
import { ShadowGuardianScan } from '@/components/security/ShadowGuardianScan';
import { useNakaWallet } from '@/lib/hooks/useNakaWallet';

export default function WalletAnalysisPage() {
  const naka = useNakaWallet();
  const [input, setInput] = useState('');
  const [target, setTarget] = useState<string | null>(null);

  const runScan = () => {
    const addr = input.trim();
    if (addr) setTarget(addr);
  };

  const useConnected = () => {
    if (naka.address) {
      setInput(naka.address);
      setTarget(naka.address);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
        <h2 className="text-sm font-bold">Wallet Analysis</h2>
      </div>

      <div className="nl-glass rounded-2xl p-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
        <label htmlFor="wa-input" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-2">
          Wallet or token contract address
        </label>
        <div className="flex items-center gap-2">
          <input
            id="wa-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runScan()}
            placeholder="0x… or Solana address"
            className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-[#0066FF]/30"
          />
          <button
            type="button"
            onClick={runScan}
            disabled={!input.trim()}
            className="nl-btn-neon px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            Scan
          </button>
        </div>
        {naka.address && (
          <button
            type="button"
            onClick={useConnected}
            className="mt-2 text-[10px] text-[#0066FF] hover:underline"
          >
            Use connected wallet
          </button>
        )}
      </div>

      {target && <ShadowGuardianScan tokenAddress={target} onComplete={() => {}} />}

      {target && (
        <Link
          href={`/dashboard/wallet-intelligence?address=${encodeURIComponent(target)}`}
          className="nl-glass nl-glass--interactive flex items-center justify-between rounded-2xl p-4 transition-colors" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}
        >
          <div>
            <div className="text-sm font-semibold">Full alpha report</div>
            <p className="text-[11px] text-gray-400 mt-1">Trading history, PnL, smart-money flags, cluster analysis.</p>
          </div>
          <ExternalLink className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
        </Link>
      )}

      {!target && (
        <div className="nl-glass rounded-2xl p-8 text-center" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
          <Wallet className="w-10 h-10 text-gray-700 mx-auto mb-2" aria-hidden="true" />
          <p className="text-xs text-gray-500">Run a Shadow Guardian scan on any wallet or token. Results include honeypot, ownership, taxes, blacklist, and AI verdict.</p>
        </div>
      )}
    </div>
  );
}
