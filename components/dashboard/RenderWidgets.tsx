'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { DEFAULT_WIDGET_ORDER, renderWidget } from '@/lib/dashboard/widgetRegistry';
import { WidgetOrderer } from './WidgetOrderer';

/**
 * OV3: order-aware widget renderer for the dashboard home tab. Reads
 * the saved widget order from /api/dashboard/widgets, falls back to
 * the default if empty / unauthenticated, and renders each widget in
 * sequence. Includes a small "Customise" button that opens the
 * WidgetOrderer modal.
 *
 * Each widget component is responsible for its own self-hide logic
 * (PortfolioHeroCard returns null when the user has no wallets, etc.)
 * — RenderWidgets just controls order, not visibility heuristics.
 */
export function RenderWidgets() {
  const [order, setOrder] = useState<string[]>([...DEFAULT_WIDGET_ORDER]);
  const [showOrderer, setShowOrderer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/widgets');
        if (!res.ok) return;
        const j = await res.json() as { widgets?: string[] };
        if (cancelled) return;
        const saved = Array.isArray(j.widgets) ? j.widgets.filter((s) => DEFAULT_WIDGET_ORDER.includes(s)) : [];
        if (saved.length === 0) return; // keep default order
        const missing = DEFAULT_WIDGET_ORDER.filter((s) => !saved.includes(s));
        setOrder([...saved, ...missing]);
      } catch {
        // Network blip — render default order silently.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setShowOrderer(true)}
          aria-label="Customise dashboard widgets"
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-full px-2.5 py-1"
        >
          <Settings className="w-3 h-3" aria-hidden="true" />
          Customise
        </button>
      </div>
      {order.map((slug) => renderWidget(slug))}
      <WidgetOrderer open={showOrderer} onClose={() => setShowOrderer(false)} onSaved={setOrder} />
    </>
  );
}
