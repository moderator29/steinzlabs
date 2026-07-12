'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, ArrowUpRight } from 'lucide-react';
import { StockChart } from './StockChart';
import { ArticleReader } from './ArticleReader';

const UP = '#10B981';
const DOWN = '#F43F5E';
const TIMEFRAMES = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '2Y'] as const;

interface Detail {
  available: boolean;
  symbol: string; name: string; exchange: string | null; currency: string;
  price: number; change: number | null; changePct: number | null;
  postPrice: number | null; postChange: number | null; marketState: string | null;
  prevClose: number | null;
  points: Array<{ t: number; c: number }>;
  stats: { open: number | null; high: number | null; low: number | null; volume: number | null; peRatio: number | null; marketCap: number | null; week52High: number | null; week52Low: number | null; avgVolume: number | null };
}

interface NewsItem { uuid: string; title: string; publisher: string; link: string; publishedAt: number; thumbnail: string | null; }

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return '–';
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtBig(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–';
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
function ago(ts: number): string {
  if (!ts) return '';
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function StockDetailSheet({ symbol, name, onClose }: { symbol: string; name: string; onClose: () => void }) {
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>('1D');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [reader, setReader] = useState<{ url: string; title: string; publisher: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/markets/stocks/${encodeURIComponent(symbol)}?tf=${tf}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setDetail(j?.available ? j : null); })
      .catch(() => { if (!cancelled) setDetail(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, tf]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/markets/stocks/news?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && Array.isArray(j?.news)) setNews(j.news); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [symbol]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const up = (detail?.change ?? 0) >= 0;
  const color = up ? UP : DOWN;
  const postUp = (detail?.postChange ?? 0) >= 0;
  const stateLabel = detail?.marketState && detail.marketState !== 'REGULAR' ? 'At Close' : 'Live';

  const STAT_ROWS: Array<[string, string]> = detail ? [
    ['Open', fmt(detail.stats.open)],
    ['High', fmt(detail.stats.high)],
    ['Low', fmt(detail.stats.low)],
    ['Vol', fmtBig(detail.stats.volume)],
    ['52W H', fmt(detail.stats.week52High)],
    ['52W L', fmt(detail.stats.week52Low)],
  ] : [];

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full sm:max-w-2xl max-h-[94dvh] overflow-y-auto overscroll-contain nl-glass rounded-t-3xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
          {/* Sticky header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#0a0e1a]/92 backdrop-blur-md border-b border-white/10 rounded-t-3xl">
            <div className="min-w-0">
              <div className="text-lg font-black text-white leading-none truncate">{symbol.replace(/^\^/, '')}</div>
              <div className="text-[11px] text-white/45 truncate">{detail?.name || name}</div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>

          <div className="px-4 sm:px-6 py-4">
            {/* Price + change */}
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <div className="text-2xl font-bold text-white tabular-nums">{fmt(detail?.price)}</div>
                <div className="text-[11px] text-white/45">{stateLabel} · {detail?.exchange || detail?.currency || 'USD'}</div>
              </div>
              {detail && detail.change != null && (
                <div className="text-sm font-semibold tabular-nums" style={{ color }}>
                  {up ? '+' : ''}{fmt(detail.change)} ({up ? '+' : ''}{fmt(detail.changePct)}%)
                </div>
              )}
              {detail?.postPrice != null && (
                <div className="text-[11px] text-white/50">
                  After hrs <span className="font-semibold tabular-nums" style={{ color: postUp ? UP : DOWN }}>{fmt(detail.postPrice)} ({postUp ? '+' : ''}{fmt(detail.postChange)})</span>
                </div>
              )}
            </div>

            {/* Timeframe selector */}
            <div className="mt-3 -mx-1 px-1 overflow-x-auto no-scrollbar">
              <div className="inline-flex gap-1">
                {TIMEFRAMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTf(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tf === t ? 'bg-[#0066FF] text-white' : 'text-white/55 hover:text-white/80'}`}
                  >{t}</button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="mt-3">
              {loading ? (
                <div className="flex items-center justify-center h-[220px] text-white/40"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : detail && detail.points.length >= 2 ? (
                <StockChart points={detail.points} prevClose={detail.prevClose} up={up} />
              ) : (
                <div className="flex items-center justify-center h-[220px] text-white/40 text-sm">No chart data for this range.</div>
              )}
            </div>

            {/* Stats grid */}
            {detail && (
              <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-2.5 border-t border-white/[0.06] pt-4">
                {STAT_ROWS.map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-white/40">{k}</span>
                    <span className="text-sm font-semibold text-white tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* News */}
            {news.length > 0 && (
              <div className="mt-6">
                <div className="text-sm font-bold text-white mb-2">News</div>
                <div className="divide-y divide-white/[0.06]">
                  {news.slice(0, 8).map((n) => (
                    <button
                      key={n.uuid}
                      onClick={() => setReader({ url: n.link, title: n.title, publisher: n.publisher })}
                      className="w-full flex gap-3 py-3 text-left group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-white/45">{n.publisher} · {ago(n.publishedAt)}</div>
                        <div className="text-sm font-semibold text-white leading-snug mt-0.5 group-hover:text-[#8fb6ff] transition-colors line-clamp-3">{n.title}</div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4d94ff]">Read more <ArrowUpRight className="w-3 h-3" /></div>
                      </div>
                      {n.thumbnail ? <img src={n.thumbnail} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {reader && (
        <ArticleReader url={reader.url} fallbackTitle={reader.title} publisher={reader.publisher} onClose={() => setReader(null)} />
      )}
    </>
  );
}
