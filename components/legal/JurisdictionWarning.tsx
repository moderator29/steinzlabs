'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * One-time soft warning shown to users in sanctioned / high-risk
 * jurisdictions. Calls /api/geo (Vercel edge headers) to decide.
 * Persists dismissal in localStorage so the banner doesn't keep
 * reappearing on every page load. Compliance team's call: this is
 * advisory; the hard block lives on the trade-execute server route.
 */

interface GeoResponse {
  country: string | null;
  flagged: boolean;
}

const DISMISS_KEY = 'naka_jurisdiction_dismissed';

export function JurisdictionWarning() {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* localStorage blocked — show the warning anyway */
    }
    fetch('/api/geo', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<GeoResponse>) : null))
      .then((d) => {
        if (cancelled || !d || !d.flagged) return;
        setCountry(d.country);
        setOpen(true);
      })
      .catch(() => {
        /* network failure — fail open; better to render no banner than to fake one */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* non-fatal */
    }
  };

  if (!open) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[180] max-w-md w-[calc(100%-2rem)] rounded-2xl bg-amber-500/15 border border-amber-500/40 backdrop-blur-xl p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-100">
            Jurisdiction notice{country ? ` (${country})` : ''}
          </h3>
          <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">
            Naka Labs is a tooling platform and is not authorized to
            provide trading services in your detected location. By
            continuing you confirm you are accessing the platform in a
            way that complies with your local laws. This is not legal
            advice.
          </p>
        </div>
        <button
          onClick={close}
          className="p-1 rounded hover:bg-amber-500/20 text-amber-200 shrink-0"
          aria-label="Dismiss jurisdiction notice"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
