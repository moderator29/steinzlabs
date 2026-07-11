'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, ShieldAlert, Lock, Globe } from 'lucide-react';

interface StatDef {
  icon: React.ElementType;
  label: string;
}

interface StatsResponse {
  tokensAnalyzed: number;
  rugsDetected: number;
  swapsProtected: number;
  chainsSupported: number;
}

const STAT_DEFS: { key: keyof StatsResponse; def: StatDef }[] = [
  { key: 'tokensAnalyzed',   def: { icon: Search,      label: 'Tokens Analyzed'  } },
  { key: 'rugsDetected',     def: { icon: ShieldAlert, label: 'Rugs Detected'    } },
  { key: 'swapsProtected',   def: { icon: Lock,        label: 'Swaps Protected'  } },
  { key: 'chainsSupported',  def: { icon: Globe,       label: 'Chains Supported' } },
];

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useCountUp(target: number, duration = 1500, started: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started || target <= 0) { setCount(target); return; }
    const start = performance.now();
    let raf: number;
    function step(now: number) {
      const elapsed = Math.min((now - start) / duration, 1);
      setCount(Math.floor(target * easeOutExpo(elapsed)));
      if (elapsed < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);
  return count;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k+`;
  if (n > 0)          return `${n.toLocaleString()}`;
  return '0';
}

function StatTile({ def, target, started }: { def: StatDef; target: number; started: boolean }) {
  const raw = useCountUp(target, 1500, started);
  return (
    <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(0,102,255,.12)', border: '1px solid rgba(0,150,255,.35)' }}
      >
        <def.icon style={{ color: '#3d9bff' }} className="w-5 h-5" strokeWidth={1.6} />
      </div>
      <div>
        <div className="text-3xl sm:text-4xl font-black mb-1 tabular-nums" style={{ color: '#3d9bff' }}>
          {formatNumber(raw)}
        </div>
        <div className="text-white/50 text-[13px] font-medium">{def.label}</div>
      </div>
    </div>
  );
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/landing-stats', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json() as StatsResponse;
        if (!cancelled) setStats(json);
      } catch {
        if (!cancelled) setStats({ tokensAnalyzed: 0, rugsDetected: 0, swapsProtected: 0, chainsSupported: 7 });
      }
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setStarted(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="max-w-5xl mx-auto px-5 py-16 sm:py-20">
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background:
            'radial-gradient(120% 90% at 0% 0%, rgba(0,102,255,0.12) 0%, transparent 46%), linear-gradient(160deg, rgba(12,18,44,0.66) 0%, rgba(5,8,22,0.86) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 60px -30px rgba(0,102,255,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Grid lines inside the card, like a dashboard panel. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,102,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,102,255,.06) 1px,transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        {/* Header row with Live dot */}
        <div className="relative flex items-center justify-between px-6 sm:px-8 pt-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: '#8FA3FF' }}>
            Live on-chain
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/70">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        </div>

        <div className="relative grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/[0.06] mt-4">
          {STAT_DEFS.map(({ key, def }) => (
            <StatTile key={key} def={def} target={stats?.[key] ?? 0} started={started && stats !== null} />
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-white/35 mt-5">
        Real counters, tracked on-chain. They start at zero and grow with every genuine interaction on the platform.
      </p>
    </section>
  );
}
