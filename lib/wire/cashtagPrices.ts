'use client';

import { useEffect, useReducer } from 'react';

/**
 * A single shared, batched price store for every $cashtag chip on The Wire.
 *
 * Instead of each chip polling on its own, all mounted chips subscribe their
 * symbols here. One poller fetches them together from the EXISTING real feed
 * (`/api/predict/price?symbols=...`) and notifies subscribers. Symbols the feed
 * does not track simply never resolve, so their chip stays neutral: we never
 * fabricate a price.
 */

type Listener = () => void;

const prices = new Map<string, number | null>();
const refcounts = new Map<string, number>();
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

const POLL_MS = 12_000;

async function poll(): Promise<void> {
  const syms = Array.from(refcounts.keys());
  if (syms.length === 0 || inFlight) return;
  inFlight = true;
  try {
    const res = await fetch(`/api/predict/price?symbols=${encodeURIComponent(syms.join(','))}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const j = await res.json();
      for (const p of j?.prices ?? []) {
        const sym = String(p.symbol).toUpperCase();
        prices.set(sym, typeof p.price === 'number' && Number.isFinite(p.price) ? p.price : null);
      }
      listeners.forEach((l) => l());
    }
  } catch {
    /* keep last known values; a chip shows neutral until a price resolves */
  } finally {
    inFlight = false;
  }
}

function ensureTimer(): void {
  if (timer === null && refcounts.size > 0) {
    timer = setInterval(poll, POLL_MS);
  }
}

function maybeStop(): void {
  if (timer !== null && refcounts.size === 0) {
    clearInterval(timer);
    timer = null;
  }
}

function subscribeSymbols(symbols: string[], onUpdate: Listener): () => void {
  const norm = symbols.map((s) => s.toUpperCase());
  for (const s of norm) refcounts.set(s, (refcounts.get(s) ?? 0) + 1);
  listeners.add(onUpdate);
  ensureTimer();
  void poll(); // refresh promptly for newly added symbols
  return () => {
    for (const s of norm) {
      const next = (refcounts.get(s) ?? 1) - 1;
      if (next <= 0) refcounts.delete(s);
      else refcounts.set(s, next);
    }
    listeners.delete(onUpdate);
    maybeStop();
  };
}

/**
 * Subscribe to live prices for the given symbols. Returns a symbol->price map
 * (price is `null` when the feed does not have it). Re-renders on every update.
 */
export function useCashtagPrices(symbols: string[]): Record<string, number | null> {
  const key = Array.from(new Set(symbols.map((s) => s.toUpperCase()))).sort().join(',');
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!key) return;
    const unsub = subscribeSymbols(key.split(','), force);
    return unsub;
  }, [key]);

  const out: Record<string, number | null> = {};
  for (const s of key ? key.split(',') : []) {
    const v = prices.get(s);
    out[s] = v === undefined ? null : v;
  }
  return out;
}
