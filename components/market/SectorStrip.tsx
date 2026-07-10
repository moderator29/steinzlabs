'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers, Layers2, Landmark, Cpu, Laugh, Building2, Radio, Gamepad2,
  Compass, ArrowUpRight, ArrowDownRight, type LucideIcon,
} from 'lucide-react';

/**
 * SectorStrip — sector-rotation barometer.
 *
 * Shows category performance (L1s, L2s, DeFi, AI, memes, RWA, DePIN, gaming)
 * as a market-cap-weighted 24h change per sector, sourced from
 * GET /api/market/sectors (which aggregates CoinGecko category markets — the
 * same free source the token list uses, just grouped per category). Sectors
 * are sorted strongest-first so the leading rotation reads left-to-right.
 *
 * Real data only: if every upstream category fetch fails the API returns
 * { available: false } and this renders an honest "coming online" state
 * rather than fabricating sector numbers.
 */

interface Mover {
  symbol: string;
  change24h: number;
}

interface Sector {
  id: string;
  label: string;
  change24h: number;
  avg7d: number | null;
  coins: number;
  marketCap: number;
  topMovers: Mover[];
}

type ApiResponse =
  | { available: true; asOf: string; sectors: Sector[] }
  | { available: false; reason: string };

// Sector id → route category (matches MarketDashboard's CAT_API_MAP ids) so a
// tile deep-links into the token list filtered to that sector.
const SECTOR_META: Record<string, { icon: LucideIcon; cat: string }> = {
  layer1: { icon: Layers, cat: 'layer1' },
  layer2: { icon: Layers2, cat: 'layer2' },
  defi: { icon: Landmark, cat: 'defi' },
  ai: { icon: Cpu, cat: 'ai' },
  meme: { icon: Laugh, cat: 'meme' },
  rwa: { icon: Building2, cat: 'commodities' },
  depin: { icon: Radio, cat: 'depin' },
  gaming: { icon: Gamepad2, cat: 'gaming' },
};

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export default function SectorStrip() {
  const router = useRouter();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/market/sectors', {
          signal: AbortSignal.timeout(12_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (json.available && json.sectors.length > 0) {
          setSectors(json.sectors);
          setStatus('ready');
        } else {
          setSectors([]);
          setStatus('empty');
        }
      } catch {
        if (!cancelled) {
          setSectors([]);
          setStatus('empty');
        }
      }
    };
    void load();
    const t = setInterval(load, 300_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="nl-glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0066FF]/10 flex items-center justify-center">
            <Compass className="w-3.5 h-3.5 text-[#4D6BFF]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Sector Rotation</h3>
            <p className="text-[10px] text-gray-500">Cap-weighted 24h change by sector · leaders first</p>
          </div>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex gap-2 px-3 py-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 w-36 shrink-0 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {status === 'empty' && (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <Compass className="w-7 h-7 text-gray-600" />
          <p className="text-sm text-gray-400">Sector data coming online.</p>
          <p className="text-[11px] text-gray-600">Category performance will appear once the source reconnects.</p>
        </div>
      )}

      {status === 'ready' && (
        <div className="flex gap-2.5 px-3 py-3 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {sectors.map((s) => {
            const meta = SECTOR_META[s.id] ?? { icon: Compass, cat: 'all' };
            const Icon = meta.icon;
            const pos = s.change24h >= 0;
            const leader = s.topMovers[0];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => router.push(`/dashboard/market?category=${meta.cat}`)}
                className="group shrink-0 w-40 text-left rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-[#0066FF]/40 hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className="w-3.5 h-3.5 text-[#B4C0E0] shrink-0" />
                    <span className="text-xs font-semibold text-white truncate">{s.label}</span>
                  </div>
                  {pos ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                </div>
                <div className={`text-lg font-bold font-mono tracking-tight ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtPct(s.change24h)}
                </div>
                {/* signed magnitude bar — width by |change|, capped at 10% */}
                <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(Math.abs(s.change24h) * 10, 100)}%`,
                      background: pos ? '#10B981' : '#EF4444',
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">
                    7d {s.avg7d != null ? fmtPct(s.avg7d) : '--'}
                  </span>
                  {leader && (
                    <span className="text-gray-400 font-mono truncate max-w-[68px]" title={`${leader.symbol} ${fmtPct(leader.change24h)}`}>
                      {leader.symbol} {leader.change24h >= 0 ? '+' : ''}{leader.change24h.toFixed(0)}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
