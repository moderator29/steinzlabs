'use client';

import { motion } from 'framer-motion';
import { TrendingUp, ShieldX, Check } from 'lucide-react';

// The real 3D crypto logos already exist on the landing page (see FloatingCoins).
// Text-in-circle chips (BTC, BNB, ETH, SOL) were removed per user feedback so they
// don't duplicate and clutter alongside the 3D marks.
const COINS: Array<{ label: string; color: string; style: React.CSSProperties }> = [];

const ROWS: [string, string][] = [['Liquidity', '$8.4M'], ['Holders', '12,847'], ['Rug Risk', 'Low']];

export function HeroRight() {
  return (
    <motion.div className="hidden md:block relative"
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
      style={{ height: 480 }}>

      {/* Coin chips */}
      {COINS.map((c, i) => (
        <motion.div key={c.label}
          animate={{ y: [0, -(8 + i * 2), 0] }}
          transition={{ duration: 3.5 + i * 0.4, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute z-10 w-14 h-14 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white/15"
          style={{ ...c.style, background: `${c.color}22`, backdropFilter: 'blur(8px)', boxShadow: `0 0 20px ${c.color}44` }}>
          {c.label}
        </motion.div>
      ))}

      {/* Main VTX card — float wrapper then 3D tilt wrapper */}
      <div className="absolute" style={{ top: 48, left: '50%', transform: 'translateX(-50%)' }}>
        <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
          <div style={{ transform: 'perspective(1200px) rotateY(-8deg) rotateX(4deg)', width: 288,
            boxShadow: '0 30px 80px rgba(59,130,246,.2)' }}>
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold text-white/60">VTX Analysis</span>
                <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse ml-auto" />
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white">SOL/USDC</span>
                <span className="text-sm font-bold text-white">$183.42</span>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-xs text-white/50 mb-1.5">
                  <span>Risk Score</span><span className="text-green-400 font-semibold">12/100</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full"><div className="h-full w-[12%] bg-green-400 rounded-full" /></div>
              </div>
              {ROWS.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs py-1.5 border-t border-white/5">
                  <span className="text-white/50">{k}</span>
                  <span className="flex items-center gap-1.5 text-white font-medium">
                    {v} <Check className="w-3 h-3 text-green-400" />
                  </span>
                </div>
              ))}
              <div className="mt-3 py-1.5 rounded-lg text-center text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20">
                SAFE TO TRADE
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Whale Alert badge */}
      <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1, y: [0, -8, 0] }}
        transition={{ delay: 0.8, duration: 0.5, y: { duration: 4, delay: 1, repeat: Infinity, ease: 'easeInOut' } }}
        className="absolute z-30 w-48 rounded-xl p-3" style={{ top: 8, right: 0, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-xs font-semibold text-white">Whale Alert</span>
        </div>
        <p className="text-[10px] text-white/50">Jump Trading moved $2.4M</p>
      </motion.div>

      {/* Rug Blocked badge */}
      <motion.div initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1, y: [0, -10, 0] }}
        transition={{ delay: 1.2, duration: 0.5, y: { duration: 4.5, delay: 1.5, repeat: Infinity, ease: 'easeInOut' } }}
        className="absolute z-30 w-44 rounded-xl p-3" style={{ bottom: 32, left: 0, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 mb-1">
          <ShieldX className="w-4 h-4 text-red-400" />
          <span className="text-xs font-semibold text-white">Rug Blocked</span>
        </div>
        <p className="text-[10px] text-white/50 mb-1">Risk Score: 94/100</p>
        <span className="text-[9px] bg-red-400/20 text-red-400 px-2 py-0.5 rounded-full font-bold">AVOID</span>
      </motion.div>
    </motion.div>
  );
}
