'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Bell, Eye, Waves } from 'lucide-react';

/**
 * DailyPulseSummary — the small once-daily "what's moving" card on Overview.
 *
 * Summarises, in a line or two, what the user's followed whales and market
 * watchlist did over the last 24h, using REAL data only. It reuses the
 * existing /api/dashboard/homepage endpoint (the same fan-out that powers the
 * home shell), which returns:
 *   - follows      → wallets the user follows (user_whale_follows)
 *   - watchlist    → tokens the user watches (watchlist)
 *   - alertsToday  → alerts that TRIGGERED in the last 24h (real movement)
 *
 * When the user follows no whales and watches no tokens we show an honest
 * empty state instead of fabricating a pulse.
 */

interface HomepageData {
  watchlist?: Array<{ token_id: string; chain: string }>;
  alertsToday?: Array<{ id: string; name?: string; type?: string }>;
  alertsCount?: number;
  follows?: Array<{ whale_address: string }>;
}

function todayLabel(): string {
  try {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  } catch {
    return 'Today';
  }
}

export function DailyPulseSummary() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/homepage', {
          credentials: 'include',
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const json = (await res.json()) as HomepageData;
        if (!cancelled) setData(json);
      } catch {
        // Network/timeout — leave data null; the card self-hides (returns the
        // honest empty state) rather than showing a broken or fake pulse.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reserve nothing while the first fetch is in flight — Overview stays calm.
  if (!loaded) return null;

  const follows = data?.follows ?? [];
  const watchlist = data?.watchlist ?? [];
  const alerts = data?.alertsToday ?? [];
  const alertCount = data?.alertsCount ?? alerts.length;

  const whaleCount = follows.length;
  const watchCount = watchlist.length;

  // Honest empty state — never fabricate a pulse for a user with nothing set up.
  const isEmpty = whaleCount === 0 && watchCount === 0;

  return (
    <section
      className="relative overflow-hidden nl-glass rounded-2xl px-4 py-4 sm:px-5 mb-5"
      style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.18), inset 0 1px 0 rgba(255,255,255,.05)' }}
      aria-label="Daily pulse"
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-[#0066FF]/[0.10] shrink-0">
            <Activity className="w-3.5 h-3.5 text-[#4D6BFF]" />
          </div>
          <h3 className="text-sm font-semibold text-white truncate">Your daily pulse</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">{todayLabel()}</span>
      </div>

      {isEmpty ? (
        <p className="text-sm text-[#B4C0E0]">
          Your daily pulse will appear once you{' '}
          <Link href="/dashboard/smart-money" className="text-[#4D6BFF] hover:text-[#6FB4FF] font-medium">
            follow whales
          </Link>{' '}
          or{' '}
          <Link href="/dashboard/market" className="text-[#4D6BFF] hover:text-[#6FB4FF] font-medium">
            add a watchlist
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="text-sm text-[#D6DEF5] leading-relaxed">
            In the last 24h,{' '}
            {whaleCount > 0 && (
              <>
                <span className="text-white font-semibold">{whaleCount}</span> whale
                {whaleCount === 1 ? '' : 's'} you follow stayed on your radar
              </>
            )}
            {whaleCount > 0 && watchCount > 0 && ' and '}
            {watchCount > 0 && (
              <>
                your watchlist of <span className="text-white font-semibold">{watchCount}</span> token
                {watchCount === 1 ? '' : 's'} kept moving
              </>
            )}
            .{' '}
            {alertCount > 0 ? (
              <>
                <span className="text-[#10B981] font-semibold">{alertCount}</span> alert
                {alertCount === 1 ? '' : 's'} triggered.
              </>
            ) : (
              <span className="text-gray-500">No alerts triggered yet.</span>
            )}
          </p>

          {/* Compact real-count chips */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {whaleCount > 0 && (
              <Chip icon={Waves} label={`${whaleCount} whale${whaleCount === 1 ? '' : 's'} followed`} href="/dashboard/smart-money" />
            )}
            {watchCount > 0 && (
              <Chip icon={Eye} label={`${watchCount} token${watchCount === 1 ? '' : 's'} watched`} href="/dashboard/market?filter=watchlist" />
            )}
            <Chip icon={Bell} label={`${alertCount} alert${alertCount === 1 ? '' : 's'} · 24h`} href="/dashboard/alerts" accent />
          </div>
        </>
      )}
    </section>
  );
}

function Chip({ icon: Icon, label, href, accent }: { icon: React.ElementType; label: string; href: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors ${
        accent
          ? 'text-[#10B981] border-[#10B981]/25 bg-[#10B981]/[0.08] hover:bg-[#10B981]/[0.14]'
          : 'text-[#9FD0FF] border-[#0066FF]/25 bg-[#0066FF]/[0.10] hover:bg-[#0066FF]/[0.16]'
      }`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </Link>
  );
}

export default DailyPulseSummary;
