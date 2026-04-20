'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock, KeyRound, EyeOff, Database, Cpu, Network, AlertTriangle } from 'lucide-react';

interface Layer {
  icon: React.ElementType;
  title: string;
  detail: string;
  color: string;
}

const LAYERS: Layer[] = [
  {
    icon: ShieldCheck,
    title: 'GoPlus token scanning',
    detail: 'Every token you interact with is scanned against the GoPlus security engine before a swap, snipe, or VTX reference. Honeypots, hidden taxes, blacklists and unverified contracts are flagged — or blocked outright.',
    color: '#10B981',
  },
  {
    icon: Cpu,
    title: 'Shadow Guardian simulation',
    detail: 'Every swap is simulated on-chain in under 200ms before it’s submitted. If a token prevents selling — the fingerprint of a honeypot — the trade is aborted automatically. No gas spent, no funds lost.',
    color: '#0A1EFF',
  },
  {
    icon: Lock,
    title: 'AES-256-GCM wallet encryption',
    detail: 'Your Naka wallet keys are encrypted in your browser using AES-256-GCM with PBKDF2 (100k iterations). Only opaque ciphertext reaches our servers. We cannot decrypt your keys — ever.',
    color: '#F59E0B',
  },
  {
    icon: KeyRound,
    title: 'JWT + Supabase RLS',
    detail: 'Every protected route verifies your Supabase JWT. Every database table enforces Row-Level Security so no user can read data belonging to another account — even under a compromised service.',
    color: '#8B5CF6',
  },
  {
    icon: Database,
    title: 'Signature Insight',
    detail: 'Every wallet signature request is decoded into plain English before you sign. Unlimited approvals, dangerous permit signatures, and suspicious calldata surface automatically.',
    color: '#EC4899',
  },
  {
    icon: Network,
    title: 'Domain Shield',
    detail: 'URLs are cross-referenced against known scam databases and pattern-matched against legitimate sites. Registration age, SSL validity and WHOIS anomalies are checked in real time.',
    color: '#06B6D4',
  },
  {
    icon: EyeOff,
    title: 'Non-custodial by default',
    detail: 'Naka Labs never sees your seed phrase or private keys. Not on create, not on import, not on sign. If this platform vanished tomorrow, your funds would be unaffected because we never held them.',
    color: '#A78BFA',
  },
  {
    icon: AlertTriangle,
    title: 'Bot &amp; abuse protection',
    detail: 'Cloudflare Turnstile gates login and signup. Rate limits on every sensitive endpoint. Sentry captures errors with PII stripped. PostHog flags anomalous behaviour patterns.',
    color: '#EF4444',
  },
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
    <section ref={ref} className="relative max-w-7xl mx-auto px-5 py-24">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className={`relative transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <div className="flex flex-col items-center text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-3 py-1 text-xs text-emerald-400 font-semibold mb-4">
            <ShieldCheck className="w-3 h-3" /> Defence in depth
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            {"Security isn’t a feature."}<br /> {"It’s the default."}
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl leading-relaxed">
            Eight protection layers run on every interaction — automatically, invisibly. You cannot accidentally skip a scan. You cannot accidentally sign something dangerous. And we cannot accidentally lose your keys, because we never hold them.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LAYERS.map((l, i) => (
            <div
              key={l.title}
              className={`group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 transition-all duration-500 hover:bg-white/[0.04] hover:-translate-y-1 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ background: l.color + '18', border: `1px solid ${l.color}40` }}
              >
                <l.icon className="w-5 h-5" style={{ color: l.color }} />
              </div>
              <h3 className="text-sm font-bold text-white mb-2">{l.title}</h3>
              <p className="text-[13px] text-white/55 leading-relaxed">{l.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
