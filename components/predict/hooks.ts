'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DailyStatus,
  MarketsResponse,
  MeResponse,
  LeaderboardResponse,
  PriceResponse,
  PriceTick,
} from './types';

// A shared "is the tab visible" flag so pollers can pause when hidden.
function useVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    onChange();
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

// A generic JSON poller that pauses when the tab is hidden. Honest by design:
// it exposes loading + error so callers can render skeletons / empty states and
// never fabricate data.
function usePoller<T>(url: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const visible = useVisible();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      if (!alive.current) return;
      setData(json);
      setError(false);
    } catch {
      if (!alive.current) return;
      setError(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    if (!url || !visible) return () => { alive.current = false; };

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await load();
      if (cancelled) return;
      timer.current = setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      cancelled = true;
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [url, intervalMs, visible, load]);

  return { data, loading, error, refresh: load, setData };
}

export function useMarkets(intervalMs = 5000) {
  return usePoller<MarketsResponse>('/api/predict/markets', intervalMs);
}

export function useMe(enabled: boolean, intervalMs = 15000) {
  const poller = usePoller<MeResponse>(enabled ? '/api/predict/me' : null, intervalMs);
  return poller;
}

export function useLeaderboard(enabled: boolean, intervalMs = 30000) {
  return usePoller<LeaderboardResponse>(enabled ? '/api/predict/leaderboard' : null, intervalMs);
}

// Daily-bonus status. Polled slowly. The claim itself is a one-off POST and the
// countdown to the next window ticks client-side from `nextAt`.
export function useDaily(enabled: boolean, intervalMs = 60000) {
  return usePoller<DailyStatus>(enabled ? '/api/predict/daily' : null, intervalMs);
}

// Live price ticks for the given symbols. Returns a symbol→tick map so callers
// can look up the featured market's price without re-render churn.
export function usePrices(symbols: string[], intervalMs = 2500) {
  const key = symbols.slice().sort().join(',');
  const url = key ? `/api/predict/price?symbols=${encodeURIComponent(key)}` : null;
  const { data } = usePoller<PriceResponse>(url, intervalMs);
  const [map, setMap] = useState<Record<string, PriceTick>>({});

  useEffect(() => {
    if (!data?.prices) return;
    setMap((prev) => {
      const next = { ...prev };
      for (const p of data.prices) next[p.symbol] = p;
      return next;
    });
  }, [data]);

  return map;
}

// A 1s heartbeat so countdowns and question windows recompute live. Paused when
// the tab is hidden to avoid needless renders.
export function useNow(pausedWhenHidden = true): number {
  const [now, setNow] = useState(() => Date.now());
  const visible = useVisible();
  useEffect(() => {
    if (pausedWhenHidden && !visible) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible, pausedWhenHidden]);
  return now;
}
