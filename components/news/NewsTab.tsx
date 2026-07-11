'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Newspaper, AlertCircle, TrendingUp, TrendingDown, Bell, BellRing, Loader2, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useNotificationSettings, type NotificationSettings } from '@/lib/preferences/notificationSettings';

/**
 * NewsTab — "Naka News", our own clean crypto news feed.
 *
 * The /api/news aggregator still fetches from multiple upstream feeds in the
 * background, but NONE of those provider names/logos are shown to the reader —
 * every story is presented as Naka News. Cards render headline + summary in
 * full (no clipped text), a "Read more" affordance that opens the real article
 * in a new tab, and a per-user Bullish/Bearish vote persisted in localStorage.
 * The list scrolls continuously (progressive reveal on scroll, no "Load more"
 * button) and silently auto-refreshes every 30s. Real data only: honest loading
 * skeletons and a retry state, never fabricated stories or vote counts.
 *
 * Exported as default. No props — self-contained.
 */

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string; // kept in the payload but never rendered — backend only
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

// How many articles are revealed initially and per scroll step. The API returns
// up to ~40 items; progressive reveal keeps the DOM light on first paint.
const INITIAL_VISIBLE = 10;
const SCROLL_STEP = 8;

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

// ── per-user vote (localStorage, honest — no fabricated community counts) ─────
type Vote = 'bullish' | 'bearish';
const VOTE_STORAGE_KEY = 'naka_news_votes_v1';

function voteKeyOf(item: NewsItem): string {
  return item.id || item.url;
}

function loadVotes(): Record<string, Vote> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(VOTE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, Vote> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === 'bullish' || v === 'bearish') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function saveVotes(votes: Record<string, Vote>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes));
  } catch {
    /* storage full / disabled — vote simply won't persist */
  }
}

function VoteControl({
  vote,
  onVote,
}: {
  vote: Vote | undefined;
  onVote: (v: Vote) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label="Vote on this story">
      <button
        type="button"
        onClick={() => onVote('bullish')}
        aria-pressed={vote === 'bullish'}
        title="Bullish"
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition-colors ${
          vote === 'bullish'
            ? 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/45'
            : 'bg-emerald-500/[0.06] text-emerald-300/80 ring-emerald-500/20 hover:bg-emerald-500/15 hover:text-emerald-300'
        }`}
      >
        <TrendingUp className="h-3.5 w-3.5" />
        Bullish
      </button>
      <button
        type="button"
        onClick={() => onVote('bearish')}
        aria-pressed={vote === 'bearish'}
        title="Bearish"
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition-colors ${
          vote === 'bearish'
            ? 'bg-rose-500/20 text-rose-400 ring-rose-500/45'
            : 'bg-rose-500/[0.06] text-rose-300/80 ring-rose-500/20 hover:bg-rose-500/15 hover:text-rose-300'
        }`}
      >
        <TrendingDown className="h-3.5 w-3.5" />
        Bearish
      </button>
    </div>
  );
}

function ReadMore({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-[12px] font-semibold text-[#4d94ff] transition-colors hover:text-[#0066FF] ${className ?? ''}`}
    >
      Read more
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${c}22` }}>
        {bull ? <TrendingUp className="h-4 w-4" style={{ color: c }} /> : <TrendingDown className="h-4 w-4" style={{ color: c }} />}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Market Mood</span>
        <span className="truncate text-sm font-semibold text-white">{fg.label || 'Fear and Greed'}</span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="h-2 w-20 overflow-hidden rounded-full bg-white/10 sm:w-32">
          <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, fg.value))}%`, backgroundColor: c }} />
        </div>
        <span className="text-lg font-bold tabular-nums" style={{ color: c }}>{fg.value}</span>
      </div>
    </div>
  );
}

// ── sub-components ───────────────────────────────────────────────────────────
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

function LeadCard({
  item,
  vote,
  onVote,
}: {
  item: NewsItem;
  vote: Vote | undefined;
  onVote: (v: Vote) => void;
}) {
  const rel = relativeTime(item.publishedAt);
  return (
    <article className="nl-glass overflow-hidden rounded-2xl">
      {item.imageUrl ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block">
          <div className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
            <Thumb
              item={item}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
        </a>
      ) : null}
      <div className="p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-500/25">
            Breaking
          </span>
          {rel ? <span className="text-[11px] text-slate-400">{rel}</span> : null}
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block">
          <h2 className="text-lg font-semibold leading-snug text-white transition-colors group-hover:text-[#4d94ff] sm:text-xl">
            {item.title}
          </h2>
        </a>
        {item.summary ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-300/90">{item.summary}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-1">
          <VoteControl vote={vote} onVote={onVote} />
          <ReadMore url={item.url} />
        </div>
      </div>
    </article>
  );
}

function NewsCard({
  item,
  vote,
  onVote,
}: {
  item: NewsItem;
  vote: Vote | undefined;
  onVote: (v: Vote) => void;
}) {
  const rel = relativeTime(item.publishedAt);
  return (
    <article className="nl-glass rounded-2xl p-3.5 sm:p-4">
      <div className="flex gap-4">
        {item.imageUrl ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative hidden h-20 w-28 shrink-0 overflow-hidden rounded-xl sm:block"
          >
            <Thumb
              item={item}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </a>
        ) : null}
        <div className="min-w-0 flex-1">
          {rel ? <div className="mb-1.5 text-[11px] text-slate-400">{rel}</div> : null}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block">
            <h3 className="text-sm font-semibold leading-snug text-white transition-colors group-hover:text-[#4d94ff] sm:text-[15px]">
              {item.title}
            </h3>
          </a>
          {item.summary ? (
            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-slate-400">{item.summary}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-1">
        <VoteControl vote={vote} onVote={onVote} />
        <ReadMore url={item.url} />
      </div>
    </article>
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
    <div className="nl-glass animate-pulse rounded-2xl p-4">
      <div className="flex gap-4">
        <div className="hidden h-20 w-28 shrink-0 rounded-xl bg-white/5 sm:block" />
        <div className="flex-1 space-y-2.5 py-1">
          <div className="h-3 w-28 rounded bg-white/10" />
          <div className="h-4 w-5/6 rounded bg-white/10" />
          <div className="h-3 w-2/3 rounded bg-white/5" />
        </div>
      </div>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────
/** Small pill switch used across the news-alerts popover. */
function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-[#0066FF]' : 'bg-white/15'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

/**
 * NewsAlertToggle — opt in/out of the twice-daily news digest and explicitly
 * choose its delivery channels. Writes notification_settings via the shared
 * hook: `news_alerts` is the master switch, then two channel switches —
 * Telegram (telegram_enabled) and Email (news_email_enabled). Email is a
 * dedicated opt-in that is OFF by default, so Telegram-only users are never
 * surprised by a news email. Only renders for signed-in users. The digest is
 * dispatched by the news-digest cron to each enabled channel.
 */
function NewsAlertToggle() {
  const { user } = useAuth();
  const { settings, loading, hasExtendedSchema, update } = useNotificationSettings(user?.id ?? null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const on = Boolean(settings?.news_alerts);
  const telegramOn = Boolean(settings?.telegram_enabled);
  const emailOn = Boolean(settings?.news_email_enabled);
  const baseDisabled = loading || saving || !hasExtendedSchema;

  const patch = async (p: Partial<NotificationSettings>) => {
    if (baseDisabled) return;
    setSaving(true);
    try {
      await update(p);
    } catch {
      /* hook rolls back + logs on failure */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium ring-1 ring-inset transition-colors ${
          on
            ? 'bg-[#0066FF]/15 text-[#4d94ff] ring-[#0066FF]/30'
            : 'bg-[#0066FF]/[0.08] text-[#8fb6ff] ring-[#0066FF]/25 hover:bg-[#0066FF]/15 hover:text-white'
        }`}
        aria-expanded={open}
        title="News alerts"
      >
        {on ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        <span className="hidden sm:inline">Alerts</span>
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-white/10 bg-[#0d1120] p-3.5 shadow-2xl">
            {/* Master switch */}
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-white">News alerts</span>
              <div className="flex items-center gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
                <ToggleSwitch
                  checked={on}
                  disabled={baseDisabled}
                  onChange={() => patch({ news_alerts: !on })}
                  label="Toggle news alerts"
                />
              </div>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
              A twice-daily roundup of top crypto headlines. Choose where it&apos;s delivered.
            </p>

            {/* Channel switches — only meaningful when news alerts are on */}
            <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className={`text-[12.5px] font-medium ${on ? 'text-slate-200' : 'text-slate-500'}`}>Telegram</span>
                  <span className="text-[10.5px] text-slate-500">Requires a linked Telegram</span>
                </div>
                <ToggleSwitch
                  checked={telegramOn}
                  disabled={baseDisabled || !on}
                  onChange={() => patch({ telegram_enabled: !telegramOn })}
                  label="Toggle Telegram delivery"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className={`text-[12.5px] font-medium ${on ? 'text-slate-200' : 'text-slate-500'}`}>Email</span>
                  <span className="text-[10.5px] text-slate-500">Off by default</span>
                </div>
                <ToggleSwitch
                  checked={emailOn}
                  disabled={baseDisabled || !on}
                  onChange={() => patch({ news_email_enabled: !emailOn })}
                  label="Toggle email delivery"
                />
              </div>
            </div>

            {!hasExtendedSchema ? (
              <p className="mt-3 text-[11px] text-amber-400/80">Syncing your settings. Try again in a moment.</p>
            ) : (
              <a
                href="/dashboard/settings"
                className="mt-3 inline-block text-[11.5px] font-medium text-[#4d94ff] hover:underline"
              >
                Manage all channels in settings →
              </a>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function NewsTab() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Hydrate saved votes once on mount.
  useEffect(() => {
    setVotes(loadVotes());
  }, []);

  const castVote = useCallback((key: string, v: Vote) => {
    setVotes((prev) => {
      // Clicking the current choice again clears it (toggle off).
      const next = { ...prev };
      if (next[key] === v) delete next[key];
      else next[key] = v;
      saveVotes(next);
      return next;
    });
  }, []);

  const load = useCallback(async (isRefresh = false, silent = false) => {
    if (!silent) {
      if (isRefresh) setRefreshing(true);
      else setStatus('loading');
    }
    try {
      const res = await fetch('/api/news', { cache: 'no-store' });
      const data: NewsResponse = await res.json().catch(() => ({}));
      const list = Array.isArray(data.items) ? data.items : [];
      if (!res.ok || list.length === 0) {
        // No fabricated fallback — honest empty/error. A failed silent refresh
        // keeps the last good list on screen rather than blanking it.
        if (list.length === 0) {
          if (!silent) {
            setItems([]);
            setStatus('error');
          }
          return;
        }
      }
      setItems(list);
      setStale(Boolean(data.stale));
      if (!silent) setVisible(INITIAL_VISIBLE);
      setStatus('ready');
    } catch {
      if (!silent) {
        setItems([]);
        setStatus('error');
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the feed live: silently pull fresh headlines every 30s (no spinner,
  // preserves the reader's scroll; a failed poll keeps the current list).
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void load(true, true);
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // Infinite scroll — reveal more as the sentinel enters view (no button).
  const hasMore = items.length > visible;
  useEffect(() => {
    if (status !== 'ready' || !hasMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => Math.min(items.length, v + SCROLL_STEP));
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [status, hasMore, items.length]);

  const lead = items[0];
  const rest = items.slice(1, visible);

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden">
      {/* header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0066FF]/15 ring-1 ring-inset ring-[#0066FF]/25">
            <Newspaper className="h-[18px] w-[18px] text-[#4d94ff]" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-white">Naka News</h1>
            <p className="truncate text-[11px] text-slate-400">Live crypto headlines</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status === 'ready' && items.length > 0 ? <LivePill stale={stale} /> : null}
          <NewsAlertToggle />
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || status === 'loading'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0066FF]/[0.08] text-[#8fb6ff] ring-1 ring-inset ring-[#0066FF]/25 transition-colors hover:bg-[#0066FF]/15 hover:text-white disabled:opacity-50"
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

          <div className="space-y-3">
            {lead ? (
              <LeadCard item={lead} vote={votes[voteKeyOf(lead)]} onVote={(v) => castVote(voteKeyOf(lead), v)} />
            ) : null}
            {rest.map((item) => {
              const k = voteKeyOf(item);
              return <NewsCard key={item.id} item={item} vote={votes[k]} onVote={(v) => castVote(k, v)} />;
            })}

            {hasMore ? (
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              </div>
            ) : (
              <p className="pt-2 text-center text-[11px] text-slate-500">
                You&apos;re all caught up
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
