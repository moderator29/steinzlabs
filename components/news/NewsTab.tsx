'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Newspaper, AlertCircle } from 'lucide-react';

/**
 * NewsTab — clean, premium crypto news feed for the dashboard.
 *
 * Spine: /api/news (CoinTelegraph RSS, server-parsed + cached). Renders a
 * lead/breaking card, then a tidy list of glass news cards. Real data only:
 * honest loading skeletons and a "could not load" retry state, never fabricated.
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// ── sub-components ───────────────────────────────────────────────────────────
function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#0066FF]/15 px-2 py-0.5 text-[11px] font-medium text-[#4d94ff] ring-1 ring-inset ring-[#0066FF]/25">
      {source || 'News'}
    </span>
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

  const lead = items[0];
  const rest = items.slice(1, visible);
  const hasMore = items.length > visible;

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
            <p className="text-[11px] text-slate-400">Powered by CoinTelegraph</p>
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
              {hostOf(lead?.url || '') ? `Source ${hostOf(lead?.url || '')}` : "You're all caught up"}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
