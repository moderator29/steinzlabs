'use client';

/**
 * §3 P2-D.2 — Bubblemap inline embed on token detail.
 *
 * Bubblemaps.io serves a free public embed at app.bubblemaps.io. We
 * iframe it as a lazy-loaded panel so the user can see holder bubbles
 * + clustering inline without leaving the token page.
 *
 * Bubblemaps supports the EVM majors + Solana via chain slugs they
 * publish on their docs page.
 */

import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

interface BubblemapEmbedProps {
  chain: string;
  token: string;
  height?: number;
  className?: string;
}

const CHAIN_SLUG: Record<string, string> = {
  ethereum: 'eth',
  base:     'base',
  arbitrum: 'arbi',
  polygon:  'poly',
  optimism: 'opti',
  bsc:      'bsc',
  avalanche: 'avax',
  solana:   'sol',
};

export default function BubblemapEmbed({ chain, token, height = 480, className = '' }: BubblemapEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const slug = CHAIN_SLUG[chain.toLowerCase()];
  if (!slug) {
    return <div className={`text-xs text-slate-500 p-3 ${className}`}>Bubblemap not available for {chain}.</div>;
  }

  const url = `https://app.bubblemaps.io/${slug}/token/${token}?prevent_scroll=true&hide_sidebar=true`;
  return (
    <div className={`relative ${className}`} style={{ height }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Holder clusters</span>
        <a
          href={`https://app.bubblemaps.io/${slug}/token/${token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200"
        >
          Open in Bubblemaps <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {!loaded && (
        <div className="absolute inset-0 top-7 flex items-center justify-center bg-slate-950/40 rounded-xl">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      )}
      <iframe
        src={url}
        title={`Bubblemap for ${token} on ${chain}`}
        loading="lazy"
        className="w-full rounded-xl border border-white/[0.06]"
        style={{ height: height - 32 }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
