"use client";

import { useEffect, useRef, useState } from "react";

export interface WhaleActivityEvent {
  id: string;
  whale_address: string;
  chain: string;
  tx_hash: string;
  action: string;
  token_symbol: string | null;
  value_usd: number | null;
  counterparty_label: string | null;
  timestamp: string;
}

interface Options {
  followed?: string[];
  minUsd?: number;
  maxEvents?: number;
  enabled?: boolean;
}

interface StreamState {
  events: WhaleActivityEvent[];
  connected: boolean;
  lastHeartbeat: number | null;
  fallback: boolean;
}

const POLL_INTERVAL_MS = 20_000;

export function useWhaleActivityStream({
  followed,
  minUsd = 50_000,
  maxEvents = 100,
  enabled = true,
}: Options = {}): StreamState {
  const [events, setEvents] = useState<WhaleActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const [fallback, setFallback] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const params = new URLSearchParams({ min_usd: String(minUsd) });
    if (followed && followed.length > 0) params.set("followed", followed.join(","));

    let cancelled = false;

    function startPollingFallback() {
      setFallback(true);
      async function tick() {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/whale-tracker?limit=20&min_usd=${minUsd}`);
          if (!res.ok) return;
          const json = (await res.json()) as { events?: WhaleActivityEvent[] };
          const incoming = json.events ?? [];
          setEvents((prev) => {
            const known = new Set(prev.map((e) => e.id));
            const fresh = incoming.filter((e) => !known.has(e.id));
            const next = [...fresh, ...prev].slice(0, maxEvents);
            return next;
          });
        } catch { /* ignore */ }
      }
      void tick();
      pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    }

    try {
      const es = new EventSource(`/api/whale-activity/stream?${params.toString()}`);
      esRef.current = es;

      es.addEventListener("hello", () => {
        if (cancelled) return;
        setConnected(true);
      });

      es.addEventListener("activity", (ev: MessageEvent<string>) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(ev.data) as WhaleActivityEvent;
          lastSeenRef.current = parsed.id;
          setEvents((prev) => {
            if (prev.some((e) => e.id === parsed.id)) return prev;
            return [parsed, ...prev].slice(0, maxEvents);
          });
        } catch { /* malformed */ }
      });

      es.addEventListener("heartbeat", () => {
        if (cancelled) return;
        setLastHeartbeat(Date.now());
      });

      es.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        es.close();
        startPollingFallback();
      };
    } catch {
      startPollingFallback();
    }

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [enabled, minUsd, maxEvents, followed?.join(",") ?? ""]);

  return { events, connected, lastHeartbeat, fallback };
}
