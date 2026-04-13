'use client';

import { Brain, Shield, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';

const CHIPS = [
  { icon: Brain,      label: 'AI Analysis',        color: '#6d85ff' },
  { icon: Shield,     label: 'Rug Protection',      color: '#4ade80' },
  { icon: Zap,        label: 'Instant Swaps',       color: '#a78bfa' },
  { icon: TrendingUp, label: 'Whale Tracking',      color: '#fbbf24' },
];

const STATS = [
  { value: '12+',    label: 'Chains' },
  { value: '500+',   label: 'Rugs Blocked' },
  { value: '$4.2M+', label: 'Protected' },
];

function VTXCard() {
  return (
    <div
      className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: 'rgba(255,255,255,.06)',
        border: '1px solid rgba(255,255,255,.12)',
        boxShadow: '0 24px 64px rgba(0,0,0,.4)',
        transform: 'perspective(1200px) rotateY(-6deg) rotateX(3deg)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#0A1EFF,#6d85ff)' }}>
            <span className="text-white font-black text-[10px]">V</span>
          </div>
          <span className="text-white text-xs font-bold">VTX Analysis</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ background: 'rgba(74,222,128,.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,.3)' }}>
          LIVE
        </span>
      </div>

      {/* Token row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
            style={{ background: 'linear-gradient(135deg,#9945FF,#14F195)' }}>SOL</div>
          <div>
            <div className="text-white text-sm font-bold">SOL / USDC</div>
            <div className="text-white/40 text-[10px]">Solana</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white text-sm font-bold">$182.44</div>
          <div className="text-[10px]" style={{ color: '#4ade80' }}>+5.2%</div>
        </div>
      </div>

      {/* Risk bar */}
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-white/50">Risk Score</span>
          <span className="font-bold" style={{ color: '#4ade80' }}>12 / 100</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
          <div className="h-full rounded-full" style={{ width: '12%', background: 'linear-gradient(90deg,#4ade80,#22c55e)' }} />
        </div>
      </div>

      {/* Data rows */}
      {[
        { label: 'Liquidity Lock', value: '100% · 2yr' },
        { label: 'Top Holder',     value: '3.2%' },
        { label: 'Smart Money',    value: '7 wallets' },
      ].map(r => (
        <div key={r.label} className="flex justify-between items-center">
          <span className="text-white/40 text-[11px]">{r.label}</span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-white">
            <CheckCircle2 className="w-3 h-3" style={{ color: '#4ade80' }} />
            {r.value}
          </span>
        </div>
      ))}

      {/* Badge */}
      <div className="flex items-center justify-center gap-2 py-2 rounded-xl"
        style={{ background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.25)' }}>
        <CheckCircle2 className="w-4 h-4" style={{ color: '#4ade80' }} />
        <span className="text-xs font-bold" style={{ color: '#4ade80' }}>SAFE TO TRADE</span>
      </div>
    </div>
  );
}

interface AuthRightPanelProps {
  mode: 'login' | 'signup';
}

export function AuthRightPanel({ mode }: AuthRightPanelProps) {
  return (
    <div
      className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#0A1EFF 0%,#050ea8 30%,#07090f 65%)' }}
    >
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle,rgba(10,30,255,.35) 0%,transparent 70%)', filter: 'blur(60px)' }} />

      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }, (_, i) => ({
          w: (i * 1.618) % 2 + 1,
          top: (i * 37.7) % 100,
          left: (i * 61.8) % 100,
          opacity: (i * 0.13) % 0.4 + 0.1,
          dur: (i * 0.7) % 3 + 2,
          delay: (i * 0.4) % 3,
        })).map((s, i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{ width: s.w, height: s.w, top: `${s.top}%`, left: `${s.left}%`, opacity: s.opacity,
              animation: `pulse ${s.dur}s ease-in-out infinite`, animationDelay: `${s.delay}s` }} />
        ))}
      </div>

      {/* Top: feature chips */}
      <div className="relative z-10 flex flex-wrap gap-2">
        {CHIPS.map(c => (
          <div key={c.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: c.color }}>
            <c.icon className="w-3.5 h-3.5" />
            {c.label}
          </div>
        ))}
      </div>

      {/* Center: 3D VTX card */}
      <div className="relative z-10 flex justify-center items-center py-8">
        <VTXCard />
      </div>

      {/* Bottom */}
      <div className="relative z-10">
        {mode === 'login' ? (
          <div className="flex flex-col gap-4">
            {/* Testimonial */}
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
              <p className="text-white/70 text-sm leading-relaxed italic mb-3">
                &ldquo;Steinz Labs caught three rug pulls before I could lose anything. The VTX analysis is unlike anything else I&apos;ve used.&rdquo;
              </p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                  style={{ background: 'linear-gradient(135deg,#0A1EFF,#6d85ff)' }}>T</div>
                <div>
                  <div className="text-white text-xs font-semibold">0xTradoor</div>
                  <div className="text-white/40 text-[10px]">Smart money trader · SOL/ETH</div>
                </div>
              </div>
            </div>
            {/* Stats strip */}
            <div className="flex items-center gap-1 justify-center">
              {STATS.map((s, i) => (
                <div key={s.label}>
                  <div className="flex flex-col items-center px-4">
                    <span className="text-white font-black text-lg leading-none">{s.value}</span>
                    <span className="text-white/40 text-[10px] mt-0.5">{s.label}</span>
                  </div>
                  {i < STATS.length - 1 && <div className="w-px h-8 bg-white/10" />}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Stats chips */}
            <div className="grid grid-cols-3 gap-3">
              {STATS.map(s => (
                <div key={s.label} className="flex flex-col items-center py-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
                  <span className="text-white font-black text-xl leading-none">{s.value}</span>
                  <span className="text-white/40 text-[10px] mt-1 text-center">{s.label}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-white/30 text-xs">Join thousands of traders protecting their capital</p>
          </div>
        )}
      </div>
    </div>
  );
}
