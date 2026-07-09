'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Newspaper, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * NewsTab — clean, premium crypto news feed for the dashboard.
 *
 * Spine: /api/news (free multi-source aggregator — CoinTelegraph, WatcherGuru,
 * Decrypt, The Block, Bankless, CoinDesk, CryptoCompare, server-parsed, deduped
 * and cached). Renders a lead/breaking card, then a tidy list of glass news
 * cards with a single-select source filter row. Real data only: honest loading
 * skeletons and a "could not load" retry state, never fabricated.
 *
 * Exported as default. No props — self-contained.
 */

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  imageUrl: string | null;
  tags: string[];
}

interface NewsResponse {
  items?: NewsItem[];
  count?: number;
  stale?: boolean;
  error?: string;
}

const PAGE_SIZE = 8;

// ── helpers ───────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const then2 = new Date(iso);
  return Number.isNaN(then2.getTime())
    ? ''
    : then2.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Ordered, deduped source list for the filter row (preserves feed order).
function sourcesOf(items: NewsItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const s = (it.source || '').trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

// ── sentiment: an honest keyword read of the headline tone (labeled as a
// sentiment tag, never presented as fact). Bullish / bearish / neutral. ───────
type Sentiment = 'bullish' | 'bearish' | 'neutral';
const BULL_WORDS = ['surge', 'rally', 'soar', 'jump', 'all time high', ' ath', 'breakout', 'adopt', 'approv', 'partnership', 'upgrade', 'bullish', 'gains', 'pump', 'record', 'inflow', 'accumulat', 'milestone', 'integrat', 'rebound', 'recover', 'green'];
const BEAR_WORDS = ['crash', 'plunge', 'dump', 'plummet', 'hack', 'exploit', 'breach', ' ban', 'lawsuit', ' sue', 'charges', 'fraud', 'liquidat', 'sell off', 'selloff', 'bearish', 'decline', 'outflow', 'collapse', 'warning', 'slump', ' fud', 'delist', ' rug', 'loss', 'fear', 'sinks'];
function sentimentOf(item: { title: string; summary: string }): Sentiment {
  const t = ` ${item.title} ${item.summary} `.toLowerCase();
  let b = 0, r = 0;
  for (const k of BULL_WORDS) if (t.includes(k)) b++;
  for (const k of BEAR_WORDS) if (t.includes(k)) r++;
  if (b > r) return 'bullish';
  if (r > b) return 'bearish';
  return 'neutral';
}
function SentimentChip({ item }: { item: NewsItem }) {
  const s = sentimentOf(item);
  if (s === 'neutral') return null;
  const bull = s === 'bullish';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        bull ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' : 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
      }`}
      title="Headline sentiment read"
    >
      {bull ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {bull ? 'Bullish' : 'Bearish'}
    </span>
  );
}

// ── Fear and Greed market mood banner (real data, alternative.me) ────────────
function moodColor(v: number): string {
  if (v >= 75) return '#10B981';
  if (v >= 55) return '#34d399';
  if (v >= 45) return '#F59E0B';
  if (v >= 25) return '#fb923c';
  return '#EF4444';
}
function MoodBanner() {
  const [fg, setFg] = useState<{ value: number; label: string } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/market/fear-greed', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.available && Number.isFinite(d.value)) setFg({ value: d.value, label: d.label || '' });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!fg) return null;
  const c = moodColor(fg.value);
  const bull = fg.value >= 50;
  return (
    <div className="nl-glass mb-3 flex items-center gap-3 rounded-2xl px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${c}22` }}>
        {bull ? <TrendingUp className="h-4 w-4" style={{ color: c }} /> : <TrendingDown className="h-4 w-4" style={{ color: c }} />}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Market Mood</span>
        <span className="text-sm font-semibold text-white">{fg.label || 'Fear and Greed'}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10 sm:w-32">
          <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, fg.value))}%`, backgroundColor: c }} />
        </div>
        <span className="text-lg font-bold tabular-nums" style={{ color: c }}>{fg.value}</span>
      </div>
    </div>
  );
}

// ── sub-components ───────────────────────────────────────────────────────────
function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#0066FF]/15 px-2 py-0.5 text-[11px] font-medium text-[#4d94ff] ring-1 ring-inset ring-[#0066FF]/25">
      {source || 'News'}
    </span>
  );
}

function SourceFilter({
  sources,
  selected,
  onSelect,
}: {
  sources: string[];
  selected: string; // 'all' or a source name
  onSelect: (s: string) => void;
}) {
  if (sources.length < 2) return null;
  const options = ['all', ...sources];
  return (
    <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((opt) => {
        const active = selected === opt;
        const label = opt === 'all' ? 'All' : opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            aria-pressed={active}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors ${
              active
                ? 'bg-[#0066FF] text-white ring-[#0066FF]'
                : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function LivePill({ stale }: { stale?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/25"
      title={stale ? 'Showing cached news' : 'Live feed'}
    >
      <span className="relative flex h-2 w-2">
        {!stale && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${stale ? 'bg-amber-400' : 'bg-emerald-400'}`}
        />
      </span>
      {stale ? 'Cached' : 'Live'}
    </span>
  );
}

function Thumb({ item, className }: { item: NewsItem; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!item.imageUrl || broken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className={className}
    />
  );
}

function LeadCard({ item }: { item: NewsItem }) {
  const rel = relativeTime(item.publishedAt);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="nl-glass nl-glass--interactive group block overflow-hidden rounded-2xl"
    >
      <div className="relative">
        {item.imageUrl ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
            <Thumb
              item={item}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#040814] via-[#040814]/40 to-transparent" />
          </div>
        ) : null}
        <div className={item.imageUrl ? 'absolute inset-x-0 bottom-0 p-5' : 'p-5'}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-500/25">
              Breaking
            </span>
            <SourceChip source={item.source} />
            <SentimentChip item={item} />
            {rel ? <span className="text-[11px] text-slate-400">{rel}</span> : null}
          </div>
          <h2 className="text-lg font-semibold leading-snug text-white sm:text-xl">
            {item.title}
          </h2>
          {item.summary ? (
            <p className="mt-2 line-clamp-2 text-sm text-slate-300/90">{item.summary}</p>
          ) : null}
        </div>
      </div>
    </a>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const rel = relativeTime(item.publishedAt);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="nl-glass nl-glass--interactive group flex gap-4 rounded-2xl p-3.5 sm:p-4"
    >
      {item.imageUrl ? (
        <div className="relative hidden h-20 w-28 shrink-0 overflow-hidden rounded-xl sm:block">
          <Thumb
            item={item}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <SourceChip source={item.source} />
          <SentimentChip item={item} />
          {rel ? <span className="text-[11px] text-slate-400">{rel}</span> : null}
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white transition-colors group-hover:text-[#4d94ff] sm:text-[15px]">
          {item.title}
        </h3>
        {item.summary ? (
          <p className="mt-1 line-clamp-1 text-[13px] text-slate-400">{item.summary}</p>
        ) : null}
      </div>
      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-[#4d94ff]" />
    </a>
  );
}

function SkeletonLead() {
  return (
    <div className="nl-glass animate-pulse overflow-hidden rounded-2xl">
      <div className="aspect-[21/9] w-full bg-white/5" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="h-5 w-3/4 rounded bg-white/10" />
        <div className="h-3 w-1/2 rounded bg-white/5" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="nl-glass flex animate-pulse gap-4 rounded-2xl p-4">
      <div className="hidden h-20 w-28 shrink-0 rounded-xl bg-white/5 sm:block" />
      <div className="flex-1 space-y-2.5 py-1">
        <div className="h-3 w-28 rounded bg-white/10" />
        <div className="h-4 w-5/6 rounded bg-white/10" />
        <div className="h-3 w-2/3 rounded bg-white/5" />
      </div>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────
export default function NewsTab() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus('loading');
    try {
      const res = await fetch('/api/news', { cache: 'no-store' });
      const data: NewsResponse = await res.json().catch(() => ({}));
      const list = Array.isArray(data.items) ? data.items : [];
      if (!res.ok || list.length === 0) {
        // No fabricated fallback — honest empty/error.
        if (list.length === 0) {
          setItems([]);
          setStatus('error');
          return;
        }
      }
      setItems(list);
      setStale(Boolean(data.stale));
      setVisible(PAGE_SIZE);
      setSourceFilter('all');
      setStatus('ready');
    } catch {
      setItems([]);
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sources = sourcesOf(items);
  const filtered =
    sourceFilter === 'all' ? items : items.filter((it) => it.source === sourceFilter);
  const lead = filtered[0];
  const rest = filtered.slice(1, visible);
  const hasMore = filtered.length > visible;

  const onSelectSource = useCallback((s: string) => {
    setSourceFilter(s);
    setVisible(PAGE_SIZE);
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0066FF]/15 ring-1 ring-inset ring-[#0066FF]/25">
            <Newspaper className="h-[18px] w-[18px] text-[#4d94ff]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Crypto News</h1>
            <p className="text-[11px] text-slate-400">Aggregated from top crypto sources</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === 'ready' && items.length > 0 ? <LivePill stale={stale} /> : null}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || status === 'loading'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Refresh news"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* loading */}
      {status === 'loading' ? (
        <div className="space-y-3">
          <SkeletonLead />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : null}

      {/* error / empty */}
      {status === 'error' ? (
        <div className="nl-glass flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-inset ring-amber-500/25">
            <AlertCircle className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Could not load news</p>
            <p className="mt-1 text-[13px] text-slate-400">
              The news feed is unavailable right now.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="mt-1 inline-flex items-center gap-2 rounded-xl bg-[#0066FF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0052cc]"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : null}

      {/* ready */}
      {status === 'ready' && items.length > 0 ? (
        <div>
          <MoodBanner />
          <SourceFilter sources={sources} selected={sourceFilter} onSelect={onSelectSource} />

          {filtered.length === 0 ? (
            <div className="nl-glass rounded-2xl px-6 py-10 text-center">
              <p className="text-sm font-medium text-white">No stories from this source</p>
              <p className="mt-1 text-[13px] text-slate-400">Try another source or view all.</p>
              <button
                type="button"
                onClick={() => onSelectSource('all')}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
              >
                View all
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {lead ? <LeadCard item={lead} /> : null}
              {rest.map((item) => (
                <NewsCard key={item.id} item={item} />
              ))}

              {hasMore ? (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="w-full rounded-2xl bg-white/5 py-3 text-sm font-medium text-slate-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Load more
                </button>
              ) : (
                <p className="pt-2 text-center text-[11px] text-slate-500">
                  You&apos;re all caught up
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
