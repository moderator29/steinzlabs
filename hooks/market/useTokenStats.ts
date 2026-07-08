'use client';

import { useEffect, useRef, useState } from 'react';
import type { TokenStats } from '@/lib/market/tokenStats';

interface UseTokenStats {
  stats: TokenStats | null;
  loading: boolean;
  error: string | null;
  /** True on the tick where a fresh payload just landed — drives the live pulse. */
  justUpdated: boolean;
}

/**
 * Poll the live token-stats endpoint on a ~4s cadence for the terminal panel.
 *
 * Rate-limit safety:
 *   - Only the mounted (visible) token polls — one loop per panel instance.
 *   - Pauses entirely while the tab is hidden (Page Visibility API) and fires
 *     an immediate catch-up refresh the moment it becomes visible again.
 *   - The server route + DexScreener/GeckoTerminal layers hold short caches
 *     (4–8s), so many pollers on one hot token collapse to one upstream call.
 *   - Overlapping requests are guarded so a slow tick never stacks.
 */
export function useTokenStats(
  id: string | null,
  chain: string,
  intervalMs = 4000,
): UseTokenStats {
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(run, intervalMs);
    };

    const run = async () => {
      if (cancelled) return;
      // Skip the network entirely while hidden; keep the loop alive so we
      // resume cleanly when the tab regains focus.
      if (typeof document !== 'undefined' && document.hidden) { schedule(); return; }
      if (inFlight.current) { schedule(); return; }
      inFlight.current = true;
      try {
        const res = await fetch(
          `/api/market/token/${encodeURIComponent(id)}/stats?chain=${encodeURIComponent(chain)}`,
          { signal: AbortSignal.timeout(9000) },
        );
        if (res.ok) {
          const data = (await res.json()) as TokenStats;
          if (!cancelled) {
            setStats(data);
            setError(null);
            setJustUpdated(true);
            setTimeout(() => { if (!cancelled) setJustUpdated(false); }, 600);
          }
        } else if (!cancelled && res.status === 404) {
          setError('No live market data for this token');
        }
      } catch {
        // Transient network/timeout — keep the last good snapshot, retry next tick.
      } finally {
        inFlight.current = false;
        if (!cancelled) { setLoading(false); schedule(); }
      }
    };

    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        if (timer) clearTimeout(timer);
        run();
      }
    };

    run();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [id, chain, intervalMs]);

  return { stats, loading, error, justUpdated };
}
