'use client';

/**
 * Renders compact live coin cards under a Wire post or Group message that
 * references a contract address. Contract addresses are unambiguous, so they
 * resolve to an exact coin; tap opens the coin. Real data only, hidden when a
 * reference does not resolve. Tickers are made clickable by renderRichText.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CoinLogo, PriceDelta } from './atoms';
import { coinPrice, compactUsd } from '@/lib/coins/format';

interface MiniCoin { chain: string; tokenAddress: string; symbol: string; name: string; logoUrl: string | null; priceUsd: number | null; marketCapUsd: number | null; change24h: number | null; verified: boolean }

const EVM_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOL_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

function extractAddresses(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(EVM_RE) ?? []) out.add(m);
  for (const m of text.match(SOL_RE) ?? []) {
    // Avoid matching plain words: require it not be all-lowercase letters.
    if (/[0-9]/.test(m) || /[A-Z]/.test(m)) out.add(m);
  }
  return [...out].slice(0, 2);
}

export function CoinCardsFromText({ text }: { text: string }) {
  const [coins, setCoins] = useState<MiniCoin[]>([]);
  useEffect(() => {
    const addrs = extractAddresses(text);
    if (addrs.length === 0) return;
    let alive = true;
    (async () => {
      const found: MiniCoin[] = [];
      for (const a of addrs) {
        try {
          const r = await fetch(`/api/coins/resolve?q=${encodeURIComponent(a)}`, { cache: 'no-store' });
          const j = await r.json();
          if (j.coin) found.push(j.coin);
        } catch { /* skip */ }
      }
      if (alive) setCoins(found);
    })();
    return () => { alive = false; };
  }, [text]);

  if (coins.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {coins.map((c) => (
        <Link
          key={`${c.chain}:${c.tokenAddress}`}
          href={`/dashboard/coins/${c.chain}/${encodeURIComponent(c.tokenAddress)}`}
          className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 bg-white/[0.03] border border-[#0066FF]/20 hover:bg-white/[0.05] transition-colors"
        >
          <CoinLogo logoUrl={c.logoUrl} symbol={c.symbol} chain={c.chain} size={34} verified={c.verified} />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-white truncate">{c.symbol}</div>
            <div className="text-[11px] text-white/45 truncate">{compactUsd(c.marketCapUsd)} MC</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[13px] font-semibold text-white tabular-nums">{coinPrice(c.priceUsd)}</div>
            <PriceDelta value={c.change24h} className="text-[11px]" />
          </div>
        </Link>
      ))}
    </div>
  );
}
