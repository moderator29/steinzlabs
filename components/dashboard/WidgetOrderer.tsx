'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Loader2, Settings, X } from 'lucide-react';
import { DASHBOARD_WIDGETS, DEFAULT_WIDGET_ORDER } from '@/lib/dashboard/widgetRegistry';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

/**
 * OV3: dashboard widget reorder + visibility UI. Reads the user's
 * saved order from /api/dashboard/widgets, lets them drag (desktop)
 * or tap arrows (touch) to reorder, and PATCH-persists on every
 * change. The dashboard home tab's <RenderWidgets /> reads the same
 * endpoint and honors the order on next render.
 *
 * Native HTML5 drag-drop — no react-beautiful-dnd dep. Each row
 * doubles as an arrow-key reorder target on the keyboard path:
 *   ArrowUp / ArrowDown moves the row when focused.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (order: string[]) => void;
}

export function WidgetOrderer({ open, onClose, onSaved }: Props) {
  const [order, setOrder] = useState<string[]>([...DEFAULT_WIDGET_ORDER]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const containerRef = useFocusTrap<HTMLDivElement>(open, onClose);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/dashboard/widgets');
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`);
          return;
        }
        const j = await res.json() as { widgets?: string[] };
        if (cancelled) return;
        const saved = Array.isArray(j.widgets) ? j.widgets.filter((s) => DEFAULT_WIDGET_ORDER.includes(s)) : [];
        // Append any new widgets the registry knows about but the user
        // hasn't pinned yet, so a future widget is opt-in visible.
        const missing = DEFAULT_WIDGET_ORDER.filter((s) => !saved.includes(s));
        setOrder(saved.length > 0 ? [...saved, ...missing] : [...DEFAULT_WIDGET_ORDER]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const persist = useCallback(async (next: string[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/widgets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? `HTTP ${res.status}`);
        return;
      }
      onSaved?.(next);
    } finally {
      setSaving(false);
    }
  }, [onSaved]);

  const move = (idx: number, delta: -1 | 1) => {
    const j = idx + delta;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
    void persist(next);
  };

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    dragFrom.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === idx) return;
    const next = order.slice();
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    setOrder(next);
    void persist(next);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Customise dashboard widgets"
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-[#0a0f1a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0066FF]/15 flex items-center justify-center">
            <Settings className="w-4 h-4 text-[#8FA3FF]" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white leading-tight">Customise dashboard</h2>
            <p className="text-[11px] text-slate-400">Drag to reorder. Tap arrows on mobile.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customise dashboard"
            className="p-1.5 rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading saved order…
          </div>
        ) : (
          <ul className="space-y-2" aria-busy={saving}>
            {order.map((slug, idx) => {
              const meta = DASHBOARD_WIDGETS.find((w) => w.slug === slug);
              if (!meta) return null;
              return (
                <li
                  key={slug}
                  draggable
                  onDragStart={handleDragStart(idx)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') { e.preventDefault(); move(idx, -1); }
                    else if (e.key === 'ArrowDown') { e.preventDefault(); move(idx, 1); }
                  }}
                  tabIndex={0}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] px-3 py-2.5 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#0066FF]/60"
                >
                  <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{meta.label}</div>
                    <div className="text-[11px] text-slate-400 truncate">{meta.description}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0 || saving}
                      aria-label={`Move ${meta.label} up`}
                      className="p-1 rounded-md hover:bg-white/[0.06] disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === order.length - 1 || saving}
                      aria-label={`Move ${meta.label} down`}
                      className="p-1 rounded-md hover:bg-white/[0.06] disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
          <span>{saving ? 'Saving…' : 'Changes save automatically.'}</span>
          <button
            type="button"
            onClick={() => { setOrder([...DEFAULT_WIDGET_ORDER]); void persist([...DEFAULT_WIDGET_ORDER]); }}
            className="text-slate-300 hover:text-white underline-offset-2 hover:underline"
          >
            Reset to default
          </button>
        </div>
      </div>
    </div>
  );
}
