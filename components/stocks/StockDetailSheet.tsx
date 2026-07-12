'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, ArrowUpRight, Star, Bell } from 'lucide-react';
import { StockChart } from './StockChart';
import { ArticleReader } from './ArticleReader';
import { addAlert, removeAlert, alertsForSymbol, type StockAlert } from '@/lib/stocks/alerts';

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

export function StockDetailSheet({ symbol, name, onClose, uid, starred, onToggleStar }: {
  symbol: string; name: string; onClose: () => void;
  uid?: string | null; starred?: boolean; onToggleStar?: () => void;
}) {
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>('1D');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [reader, setReader] = useState<{ url: string; title: string; publisher: string } | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTarget, setAlertTarget] = useState('');
  const [alertDir, setAlertDir] = useState<'above' | 'below'>('above');

  useEffect(() => {
    let cancelled = false;
    if (!uid) { setAlerts([]); return; }
    alertsForSymbol(symbol).then((a) => { if (!cancelled) setAlerts(a); });
    return () => { cancelled = true; };
  }, [uid, symbol]);

  const saveAlert = async () => {
    const t = parseFloat(alertTarget);
    if (!Number.isFinite(t) || t <= 0) return;
    const created = await addAlert({ symbol, name: detail?.name || name, target: t, direction: alertDir });
    if (created) setAlerts((cur) => [created, ...cur.filter((a) => a.id !== created.id)]);
    setAlertTarget('');
    setAlertOpen(false);
  };
  const dropAlert = async (id: string) => { const ok = await removeAlert(id); if (ok) setAlerts((cur) => cur.filter((a) => a.id !== id)); };

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
    ['Vol', fmtBig(detail.stats.volume)],
    ['Mkt Cap', fmtBig(detail.stats.marketCap)],
    ['High', fmt(detail.stats.high)],
    ['P/E', fmt(detail.stats.peRatio)],
    ['Avg Vol', fmtBig(detail.stats.avgVolume)],
    ['Low', fmt(detail.stats.low)],
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
            <div className="flex items-center gap-1 shrink-0">
              {onToggleStar && (
                <button onClick={onToggleStar} aria-pressed={!!starred} className="p-1.5 rounded-lg hover:bg-white/10" aria-label={starred ? 'Unstar' : 'Add to watchlist'}>
                  <Star className="w-4 h-4" style={{ color: starred ? '#F5B841' : 'rgba(255,255,255,0.55)', fill: starred ? '#F5B841' : 'none' }} />
                </button>
              )}
              <button onClick={() => setAlertOpen((v) => !v)} className={`p-1.5 rounded-lg hover:bg-white/10 ${alerts.length ? 'text-[#4d94ff]' : 'text-white/55'}`} aria-label="Price alert"><Bell className="w-4 h-4" /></button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
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

            {/* Price alert (on-device, fires while the app is open) */}
            {(alertOpen || alerts.length > 0) && (
              <div className="mt-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
                {alerts.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {alerts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-white/70">Alert when {a.direction} <span className="font-semibold text-white tabular-nums">{fmt(Number(a.target))}</span>{a.fired_at ? <span className="ml-1.5 text-emerald-300">· triggered</span> : ''}</span>
                        <button onClick={() => dropAlert(a.id)} className="text-white/40 hover:text-rose-300" aria-label="Remove alert"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                {alertOpen && (
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg bg-white/[0.05] p-0.5">
                      {(['above', 'below'] as const).map((d) => (
                        <button key={d} onClick={() => setAlertDir(d)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize ${alertDir === d ? 'bg-[#0066FF] text-white' : 'text-white/55'}`}>{d}</button>
                      ))}
                    </div>
                    <input value={alertTarget} onChange={(e) => setAlertTarget(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveAlert(); }} inputMode="decimal" placeholder="Target price" className="flex-1 min-w-0 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-base sm:text-sm text-white placeholder:text-white/35 outline-none focus:border-[#0066FF]/40" />
                    <button onClick={saveAlert} className="h-9 px-3 rounded-lg bg-[#0066FF] text-white text-xs font-semibold shrink-0">Set</button>
                  </div>
                )}
              </div>
            )}

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

            {/* 52-week range bar — where the price sits between the year's low/high */}
            {detail && detail.stats.week52Low != null && detail.stats.week52High != null && detail.stats.week52High > detail.stats.week52Low && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
                  <span>52-week range</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-white/[0.08]">
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: '100%', background: 'linear-gradient(90deg,#F43F5E33,#10B98133)' }} />
                  {(() => {
                    const lo = detail.stats.week52Low!, hi = detail.stats.week52High!;
                    const pct = Math.min(100, Math.max(0, ((detail.price - lo) / (hi - lo)) * 100));
                    return <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 border-[#0a0e1a]" style={{ left: `${pct}%`, background: color }} />;
                  })()}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-white/50 mt-1.5">
                  <span>{fmt(detail.stats.week52Low)}</span>
                  <span>{fmt(detail.stats.week52High)}</span>
                </div>
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
