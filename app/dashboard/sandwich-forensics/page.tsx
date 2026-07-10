'use client';

import { useState } from 'react';
import { Search, Loader2, Swords, AlertTriangle } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface Result {
  address: string;
  totalLossUsd: number;
  eventCount: number;
  sandwichCount: number;
  frontrunCount: number;
  worstLossUsd: number;
  events: Array<{ tx_hash: string; block_number: number; mev_type: string; loss_usd: number }>;
}

function usd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

export default function SandwichForensicsPage() {
  const [addr, setAddr] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    const a = addr.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(a)) { setErr('Enter a valid Ethereum address (0x…).'); return; }
    setLoading(true); setErr(null); setData(null);
    try {
      const res = await fetch(`/api/security/sandwich?address=${encodeURIComponent(a)}`);
      if (!res.ok) { setErr('Lookup failed.'); return; }
      setData(await res.json());
    } catch { setErr('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton />
        <h1 className="text-lg font-bold flex items-center gap-2"><Swords className="w-5 h-5 text-[#0066FF]" /> Sandwich Forensics</h1>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        How much MEV was extracted <span className="text-white">from your own swaps</span>: sandwiches and frontruns detected against your address on Ethereum (ZeroMEV, last 30 days). Nobody else ties MEV to <em>your</em> fills.
      </p>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-[#0A0E27] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-[#0066FF]/40">
          <Search className="w-4 h-4 text-gray-600 shrink-0" />
          <input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Your Ethereum address (0x…)" className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600" />
        </div>
        <button onClick={run} disabled={loading} className="px-4 rounded-xl bg-[#0066FF] text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan'}
        </button>
      </div>

      {err && <div className="nl-glass rounded-xl p-4 text-sm text-amber-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {err}</div>}

      {data && (
        <div className="space-y-3">
          {data.eventCount === 0 ? (
            <div className="nl-glass rounded-xl p-6 text-center">
              <div className="text-2xl font-bold text-[#10B981] mb-1">Clean</div>
              <p className="text-sm text-slate-400">No sandwich or frontrun MEV recorded against this address in the last 30 days on Ethereum. That&rsquo;s a good result.</p>
            </div>
          ) : (
            <>
              <div className="nl-glass rounded-xl p-5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">MEV extracted from you (30d)</div>
                <div className="text-4xl font-bold text-[#EF4444]">{usd(data.totalLossUsd)}</div>
                <div className="text-xs text-slate-500 mt-1">across {data.eventCount} attack{data.eventCount !== 1 ? 's' : ''}</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="nl-glass rounded-xl p-3 text-center"><div className="text-lg font-bold">{data.sandwichCount}</div><div className="text-[10px] text-slate-500">Sandwiches</div></div>
                <div className="nl-glass rounded-xl p-3 text-center"><div className="text-lg font-bold">{data.frontrunCount}</div><div className="text-[10px] text-slate-500">Frontruns</div></div>
                <div className="nl-glass rounded-xl p-3 text-center"><div className="text-lg font-bold text-[#EF4444]">{usd(data.worstLossUsd)}</div><div className="text-[10px] text-slate-500">Worst hit</div></div>
              </div>
              <div className="nl-glass rounded-xl p-4">
                <div className="text-xs font-semibold mb-2">Attacks (largest first)</div>
                <div className="space-y-1.5">
                  {data.events.map((e) => (
                    <div key={e.tx_hash} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 capitalize">{e.mev_type} · block {e.block_number.toLocaleString()}</span>
                      <span className="font-mono text-[#EF4444]">-{usd(Number(e.loss_usd))}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-600">Tip: route large swaps through the MEV-protected path (private mempool) in Settings to avoid this. Detection is Ethereum-only via ZeroMEV.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
