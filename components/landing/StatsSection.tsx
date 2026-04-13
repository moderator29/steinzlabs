'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, ShieldAlert, Lock, Globe } from 'lucide-react';

interface Stat {
  icon: React.ElementType;
  value: string;
  numeric: number;
  suffix: string;
  label: string;
  color: string;
  bg: string;
}

const STATS: Stat[] = [
  { icon: Search,      value: '12,000+', numeric: 12000, suffix: '+', label: 'Tokens Analyzed',  color: '#6d85ff', bg: 'rgba(10,30,255,.12)' },
  { icon: ShieldAlert, value: '500+',    numeric: 500,   suffix: '+', label: 'Rugs Detected',    color: '#f87171', bg: 'rgba(220,38,38,.12)' },
  { icon: Lock,        value: '$4.2M+',  numeric: 4.2,   suffix: 'M+', label: 'Swaps Protected', color: '#4ade80', bg: 'rgba(22,163,74,.12)'  },
  { icon: Globe,       value: '12+',     numeric: 12,    suffix: '+', label: 'Chains Supported', color: '#fbbf24', bg: 'rgba(217,119,6,.12)'  },
];

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useCountUp(target: number, duration = 2000, started: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    let raf: number;
    function step(now: number) {
      const elapsed = Math.min((now - start) / duration, 1);
      setCount(target * easeOutExpo(elapsed));
      if (elapsed < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);
  return count;
}

function StatCard({ stat, started }: { stat: Stat; started: boolean }) {
  const raw = useCountUp(stat.numeric, 2000, started);

  let display: string;
  if (stat.suffix === 'M+') {
    display = raw.toFixed(1) + stat.suffix;
  } else {
    display = Math.floor(raw).toLocaleString() + stat.suffix;
  }
  if (stat.value.startsWith('$')) display = '$' + display;

  return (
    <div className="flex flex-col items-center gap-4 p-8 rounded-2xl text-center"
      style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
      <div className="w-14 h-14 rounded-xl flex items-center justify-center"
        style={{ background: stat.bg, border: `1px solid ${stat.color}33` }}>
        <stat.icon style={{ color: stat.color }} className="w-6 h-6" strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-4xl font-black text-white mb-1 tabular-nums" style={{ color: stat.color }}>{display}</div>
        <div className="text-white/50 text-sm font-medium">{stat.label}</div>
      </div>
    </div>
  );
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map(s => <StatCard key={s.label} stat={s} started={started} />)}
      </div>
    </section>
  );
}
