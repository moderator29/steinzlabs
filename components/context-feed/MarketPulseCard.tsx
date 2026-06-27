'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { ContextEvent } from '@/lib/hooks/useContextFeed';

/**
 * MarketPulseCard — an AI "Market Pulse" read on the live feed. Posts the
 * current top events to /api/context-feed/pulse (server-cached 5 min) and
 * renders a glass blue-stride card. Auto-hides until it has a real summary;
 * never shows fabricated text.
 */

const TONE_COLOR: Record<string, string> = {
  bullish: '#10B981',
  bearish: '#EF4444',
  mixed: '#F59E0B',
  neutral: '#8FA3FF',
};

export function MarketPulseCard({ events }: { events: ContextEvent[] }) {
  const [pulse, setPulse] = useState<string | null>(null);
  const [tone, setTone] = useState<string>('mixed');
  const requestedRef = useRef(false);

  useEffect(() => {
    // Fire once, after the feed has a meaningful sample of events.
    if (requestedRef.current || events.length < 5) return;
    requestedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const top = events.slice(0, 24).map((e) => ({
          title: e.title,
          tokenSymbol: e.tokenSymbol,
          chain: e.chain,
          tokenPriceChange24h: e.tokenPriceChange24h,
          tokenVolume24h: e.tokenVolume24h,
          sentiment: e.sentiment,
        }));
        const res = await fetch('/api/context-feed/pulse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: top }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.pulse) { setPulse(data.pulse); setTone(data.tone || 'mixed'); }
      } catch { /* silent — card just stays hidden */ }
    })();
    return () => { cancelled = true; };
  }, [events]);

  if (!pulse) return null;
  const color = TONE_COLOR[tone] ?? TONE_COLOR.neutral;

  return (
    <div
      className="nl-glass rounded-2xl p-4 relative overflow-hidden"
      style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 18px rgba(0,102,255,.2)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg" style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 55%,#7C3AED)', boxShadow: '0 0 12px rgba(0,102,255,.5)' }}>
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </span>
        <h3 className="text-sm font-bold text-white tracking-wide">Market Pulse</h3>
        <span className="ms-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}1A`, border: `1px solid ${color}40` }}>
          {tone}
        </span>
      </div>
      <p className="text-[13px] text-slate-200 leading-relaxed">{pulse}</p>
      <div className="text-[9px] text-slate-500 mt-2">AI-generated from live on-chain signals · refreshed periodically · not financial advice</div>
    </div>
  );
}
