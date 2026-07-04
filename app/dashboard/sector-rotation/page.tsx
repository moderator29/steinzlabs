'use client';

// Narrative Radar — sector rotation. Which crypto narratives capital is flowing
// into vs out of over 24h, from CoinGecko category market caps. Real data only.

import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Compass } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { sectorRotationHowItWorks } from '@/lib/howItWorks/content/sector-rotation';

interface Sector { id: string; name: string; marketCap: number; change24h: number; volume24h: number; topCoins: string[] }
interface Data { rotatingIn: Sector[]; rotatingOut: Sector[]; total: number }

function fmtUsd(n: number) { const a = Math.abs(n); if (a >= 1e12) return `$${(a / 1e12).toFixed(2)}T`; if (a >= 1e9) return `$${(a / 1e9).toFixed(1)}B`; if (a >= 1e6) return `$${(a / 1e6).toFixed(0)}M`; return `$${Math.round(a)}`; }

function Row({ s }: { s: Sector }) {
  const up = s.change24h >= 0;
  return (
    <div className="nl-card rounded-xl p-3 flex items-center gap-3">
      <div className="flex -space-x-2 shrink-0">
        {s.topCoins.length > 0 ? s.topCoins.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" className="w-6 h-6 rounded-full border border-[#0A0E1A] bg-[#0A0E1A] object-cover" />
        )) : <div className="w-6 h-6 rounded-full bg-white/10" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{s.name}</div>
        <div className="text-[10px] text-slate-500">{fmtUsd(s.marketCap)} mcap · {fmtUsd(s.volume24h)} vol</div>
      </div>
      <div className="text-right shrink-0 inline-flex items-center gap-1" style={{ color: up ? '#10B981' : '#FF1744' }}>
        {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        <span className="text-sm font-bold">{up ? '+' : ''}{s.change24h.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function SectorRotationPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/trends/sectors', { cache: 'no-store' });
        if (!cancelled && res.ok) setData(await res.json());
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-5">
        <BackButton href="/dashboard" compact />
        <span className="text-white font-semibold inline-flex items-center gap-2"><Compass className="w-4 h-4 text-[#00C8FF]" /> Narrative Radar</span>
        <HowItWorksButton content={sectorRotationHowItWorks} className="ms-auto shrink-0" />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Where capital is rotating</h1>
        <p className="text-slate-400 text-sm mt-1">Which crypto narratives are gaining and losing market cap over the last 24 hours.</p>
      </div>

      {loading && <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && data && (
        <div className="space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[#10B981] font-semibold mb-2 ms-1 inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Rotating in</div>
            <div className="space-y-2">{data.rotatingIn.map((s) => <Row key={s.id} s={s} />)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[#FF1744] font-semibold mb-2 ms-1 inline-flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Rotating out</div>
            <div className="space-y-2">{data.rotatingOut.map((s) => <Row key={s.id} s={s} />)}</div>
          </div>
          <p className="text-[10px] text-slate-600 text-center">Real category market caps · CoinGecko · {data.total} sectors tracked</p>
        </div>
      )}

      {!loading && (!data || (data.rotatingIn.length === 0)) && (
        <div className="nl-glass rounded-2xl p-6 text-center text-slate-400 text-sm">Sector data is briefly unavailable — check back in a minute.</div>
      )}
    </div>
  );
}
