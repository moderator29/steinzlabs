'use client';

/**
 * GDPR / UK PECR — minimum-viable cookie consent banner. Renders once
 * per browser until the user picks Essential-only or Accept-all.
 *
 * Today the platform sets analytics cookies (PostHog) before any
 * consent is collected, which fails GDPR / UK PECR / CCPA disclosure
 * requirements. The dispatched `naka:cookie-consent-changed` event +
 * the persisted choice in localStorage let downstream code (PostHog
 * provider, Sentry replay if enabled) gate themselves on the user's
 * decision before initializing.
 *
 * This is a minimum-viable bar — for full multi-purpose granular
 * consent (analytics vs ads vs personalization), swap to OneTrust or
 * Osano in a follow-up. Until then this satisfies the disclose-and-
 * choose obligation that's currently missing.
 */

import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import Link from 'next/link';

const STORAGE_KEY = 'naka_cookie_consent';
const EVENT_NAME = 'naka:cookie-consent-changed';

export type ConsentChoice = 'essential' | 'all';

export function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'essential' || v === 'all' ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
    localStorage.setItem(`${STORAGE_KEY}_at`, new Date().toISOString());
    window.dispatchEvent(new CustomEvent<ConsentChoice>(EVENT_NAME, { detail: choice }));
  } catch {
    /* storage disabled (Safari private) — non-fatal */
  }
}

export default function CookieConsent() {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setChoice(readConsent());
    setHydrated(true);
  }, []);

  const accept = (c: ConsentChoice) => {
    writeConsent(c);
    setChoice(c);
  };

  useEffect(() => {
    if (!hydrated || choice !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        accept('essential');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hydrated, choice]);

  if (!hydrated || choice !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[60] rounded-2xl border border-white/10 bg-[#0A0E1A]/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-white/5 p-2 text-[#8FA3FF] shrink-0">
          <Cookie className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white mb-1">We use cookies</h2>
          <p className="text-[12px] leading-relaxed text-slate-300">
            Essential cookies keep you signed in and your preferences saved. With your
            permission we also use product analytics to understand how you use Naka Labs
            so we can ship better. You can change this any time in{' '}
            <Link href="/settings" className="text-[#8FA3FF] hover:underline">
              Settings
            </Link>
            . See our{' '}
            <Link href="/privacy" className="text-[#8FA3FF] hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => accept('essential')}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => accept('all')}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-xs font-semibold text-white hover:scale-[1.02] transition-transform"
            >
              Accept all
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => accept('essential')}
          className="text-slate-400 hover:text-white shrink-0 -me-1 -mt-1 p-1"
          aria-label="Dismiss (Essential only)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export const COOKIE_CONSENT_EVENT = EVENT_NAME;
