'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock, KeyRound, EyeOff, Database, Cpu, Network, AlertTriangle } from 'lucide-react';

interface Layer {
  icon: React.ElementType;
  title: string;
  detail: string;
}

const LAYERS: Layer[] = [
  { icon: ShieldCheck,     title: 'GoPlus token scanning',   detail: 'Honeypots, hidden taxes, and unverified contracts flagged before any swap.' },
  { icon: Cpu,             title: 'Shadow Guardian sim',      detail: 'Every swap is simulated on-chain first. If it cannot sell, it is aborted.' },
  { icon: Lock,            title: 'AES-256-GCM encryption',   detail: 'Wallet keys are encrypted in your browser. Only ciphertext reaches us.' },
  { icon: KeyRound,        title: 'JWT + Supabase RLS',       detail: 'Row-level security means no account can ever read another account’s data.' },
  { icon: Database,        title: 'Signature Insight',        detail: 'Every signature request is decoded into plain English before you sign.' },
  { icon: Network,         title: 'Domain Shield',            detail: 'URLs are checked against scam databases and phishing patterns in real time.' },
  { icon: EyeOff,          title: 'Non-custodial by default', detail: 'We never see your seed phrase or keys. If we vanished, your funds are fine.' },
  { icon: AlertTriangle,   title: 'Bot + abuse protection',   detail: 'Turnstile gating, rate limits, and anomaly detection on every sensitive route.' },
];

export function SecurityShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="security" ref={ref} className="relative max-w-6xl mx-auto px-5 py-20 sm:py-24">
      <div className={`relative transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <div className="flex flex-col items-center text-center mb-12 max-w-2xl mx-auto">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-4"
            style={{ background: 'rgba(0,102,255,.1)', border: '1px solid rgba(0,102,255,.3)', color: '#6d85ff' }}
          >
            <ShieldCheck className="w-3 h-3" /> Defence in depth
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Security isn&apos;t a feature.{' '}
            <span style={{ color: '#1E90FF' }}>It&apos;s the default.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: '#B4C0E0' }}>
            Eight layers run automatically on every interaction. You cannot skip a scan, and we cannot lose your keys, because we never hold them.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {LAYERS.map((l, i) => (
            <div
              key={l.title}
              className={`group rounded-2xl p-5 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{
                background: 'linear-gradient(160deg, rgba(12,18,44,0.5) 0%, rgba(5,8,22,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                transitionDelay: `${i * 60}ms`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                style={{ background: 'rgba(0,102,255,.12)', border: '1px solid rgba(0,150,255,.35)' }}
              >
                <l.icon className="w-5 h-5" style={{ color: '#3d9bff' }} strokeWidth={1.6} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">{l.title}</h3>
              <p className="text-[12.5px] leading-relaxed" style={{ color: '#95a3c9' }}>{l.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
