'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, ShieldAlert, Lock, Globe } from 'lucide-react';

interface StatDef {
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  format: 'number' | 'currency';
}

interface StatsResponse {
  tokensAnalyzed: number;
  rugsDetected: number;
  swapsProtected: number;
  chainsSupported: number;
}

const STAT_DEFS: { key: keyof StatsResponse; def: StatDef }[] = [
  { key: 'tokensAnalyzed',   def: { icon: Search,      label: 'Tokens Analyzed',  color: '#6d85ff', bg: 'rgba(10,30,255,.12)',  format: 'number'  } },
  { key: 'rugsDetected',     def: { icon: ShieldAlert, label: 'Rugs Detected',    color: '#f87171', bg: 'rgba(220,38,38,.12)',  format: 'number'  } },
  { key: 'swapsProtected',   def: { icon: Lock,        label: 'Swaps Protected',  color: '#4ade80', bg: 'rgba(22,163,74,.12)',  format: 'number'  } },
  { key: 'chainsSupported',  def: { icon: Globe,       label: 'Chains Supported', color: '#fbbf24', bg: 'rgba(217,119,6,.12)',  format: 'number'  } },
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

function StatCard({
  def, target, started,
}: { def: StatDef; target: number; started: boolean }) {
  const raw = useCountUp(target, 1500, started);
  return (
    <div className="flex flex-col items-center gap-4 p-8 rounded-2xl text-center"
      style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
      <div className="w-14 h-14 rounded-xl flex items-center justify-center"
        style={{ background: def.bg, border: `1px solid ${def.color}33` }}>
        <def.icon style={{ color: def.color }} className="w-6 h-6" strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-4xl font-black mb-1 tabular-nums" style={{ color: def.color }}>
          {formatNumber(raw)}
        </div>
        <div className="text-white/50 text-sm font-medium">{def.label}</div>
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
    // Refresh every 60s so the numbers tick up for users lingering on the page.
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
    <section ref={ref} className="max-w-7xl mx-auto px-5 py-16">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_DEFS.map(({ key, def }) => (
          <StatCard key={key} def={def} target={stats?.[key] ?? 0} started={started && stats !== null} />
        ))}
      </div>
      <p className="text-center text-[11px] text-white/30 mt-5">
        Live counters. Tracked on-chain. Numbers start at zero and grow with every real interaction on the platform.
      </p>
    </section>
  );
}
