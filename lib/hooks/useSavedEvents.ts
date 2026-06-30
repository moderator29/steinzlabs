'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContextEvent } from '@/lib/hooks/useContextFeed';

export interface SavedEventRow {
  id: string;
  event_ref: string;
  payload: ContextEvent;
  saved_at: string;
}

/**
 * useSavedEvents — the per-user "Saved" vault, backed by /api/archive/save
 * (Supabase saved_events, user-id bound). Loads the user's saved rows, tracks
 * which event refs are currently saved, and exposes idempotent save / unsave
 * that update local state optimistically and reconcile against the server.
 */
export function useSavedEvents() {
  const [rows, setRows] = useState<SavedEventRow[]>([]);
  const [savedRefs, setSavedRefs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const r = await fetch('/api/archive/save', { cache: 'no-store', signal: controller.signal });
      if (r.status === 401) {
        setUnauthorized(true);
        setRows([]);
        setSavedRefs(new Set());
        return;
      }
      setUnauthorized(false);
      const j = await r.json();
      const saved: SavedEventRow[] = j.saved ?? [];
      setRows(saved);
      setSavedRefs(new Set(saved.map((s) => s.event_ref)));
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('[saved-events] load failed:', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  const save = useCallback(async (event: ContextEvent): Promise<boolean> => {
    if (!event.id) return false;
    setSavedRefs((prev) => new Set(prev).add(event.id));
    try {
      const r = await fetch('/api/archive/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_ref: event.id, payload: event }),
      });
      if (!r.ok) {
        setSavedRefs((prev) => { const n = new Set(prev); n.delete(event.id); return n; });
        return false;
      }
      const j = await r.json();
      const row: SavedEventRow | undefined = j.saved;
      if (row) {
        setRows((prev) => {
          const without = prev.filter((p) => p.event_ref !== row.event_ref);
          return [row, ...without];
        });
      }
      return true;
    } catch {
      setSavedRefs((prev) => { const n = new Set(prev); n.delete(event.id); return n; });
      return false;
    }
  }, []);

  const unsave = useCallback(async (eventRef: string): Promise<boolean> => {
    setSavedRefs((prev) => { const n = new Set(prev); n.delete(eventRef); return n; });
    setRows((prev) => prev.filter((p) => p.event_ref !== eventRef));
    try {
      const r = await fetch(`/api/archive/save?ref=${encodeURIComponent(eventRef)}`, { method: 'DELETE' });
      if (!r.ok) { await load(); return false; }
      return true;
    } catch {
      await load();
      return false;
    }
  }, [load]);

  const toggle = useCallback(async (event: ContextEvent): Promise<void> => {
    if (savedRefs.has(event.id)) { await unsave(event.id); }
    else { await save(event); }
  }, [savedRefs, save, unsave]);

  return { rows, savedRefs, loading, unauthorized, save, unsave, toggle, refresh: load };
}
