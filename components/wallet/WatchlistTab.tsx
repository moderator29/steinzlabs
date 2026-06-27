'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * WatchlistTab — the user's watchlisted coins inside the wallet, live.
 * Reads the shared `watchlist` table (token_id = CoinGecko id, same store the
 * Market tab + coin-detail star use) and renders real-time price + 24h change.
 * No mock data — empty when nothing is watched.
 */

interface Row {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
}

export function WatchlistTab() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('watchlist').select('token_id');
        const ids = (data ?? []).map((r: { token_id: string }) => r.token_id).filter(Boolean);
        if (ids.length === 0) { if (!cancelled) setRows([]); return; }
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids.join(','))}&price_change_percentage=24h`);
        if (!res.ok) { if (!cancelled) setRows([]); return; }
        const j = await res.json();
        if (cancelled) return;
        setRows((Array.isArray(j) ? j : []).map((c: Record<string, unknown>) => ({
          id: String(c.id), symbol: String(c.symbol ?? '').toUpperCase(), name: String(c.name ?? ''),
          image: String(c.image ?? ''), price: Number(c.current_price ?? 0),
          change24h: Number(c.price_change_percentage_24h ?? 0),
        })));
      } catch { if (!cancelled) setRows([]); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (rows === null) {
    return <div className="space-y-2 p-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-900/40 animate-pulse" />)}</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <Star className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-300 font-semibold mb-1">No coins watched yet</p>
        <p className="text-slate-500 text-sm">Tap the ☆ on any coin to track it here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 p-1">
      {rows.map((r) => {
        const up = r.change24h >= 0;
        return (
          <Link key={r.id} href={`/dashboard/wallet-page/coin/ethereum/${r.id}`} className="flex items-center gap-3 p-2.5 rounded-xl nl-glass" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.15)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.image ? <img src={r.image} alt="" className="w-9 h-9 rounded-full" /> : <div className="w-9 h-9 rounded-full bg-slate-700" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">{r.symbol}</div>
              <div className="text-[11px] text-slate-500 truncate">{r.name}</div>
            </div>
            <div className="text-end">
              <div className="text-sm font-semibold text-white tabular-nums">${r.price < 1 ? r.price.toFixed(4) : r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <div className={`text-[12px] font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{r.change24h.toFixed(2)}%</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
