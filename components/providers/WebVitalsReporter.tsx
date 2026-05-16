'use client';

import { useEffect } from 'react';

/**
 * Client-side Web Vitals reporter. Subscribes to the four core metrics
 * (CLS, INP, LCP, FCP) plus TTFB and posts them to /api/rum via
 * navigator.sendBeacon so the report survives page unload. No third
 * party SDK — uses Next's bundled web-vitals via PerformanceObserver
 * fallbacks so we don't add a dependency for what is ~30 lines.
 */

type Metric = {
  name: 'CLS' | 'FCP' | 'INP' | 'LCP' | 'TTFB' | 'FID';
  value: number;
  id: string;
  rating?: 'good' | 'needs-improvement' | 'poor';
};

function rate(name: Metric['name'], value: number): Metric['rating'] {
  // Thresholds from web.dev/vitals (May 2025 baselines).
  switch (name) {
    case 'LCP':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'INP':
    case 'FID':
      return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
    case 'CLS':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'FCP':
      return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    case 'TTFB':
      return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
    default:
      return undefined;
  }
}

export function WebVitalsReporter() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      return;
    }
    const buffer: Metric[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (buffer.length === 0) return;
      const payload = JSON.stringify({
        url: window.location.href,
        vitals: buffer.splice(0),
      });
      try {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon?.('/api/rum', blob)) return;
      } catch {
        /* fall through to fetch */
      }
      void fetch('/api/rum', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    };

    const report = (name: Metric['name'], value: number, id: string) => {
      buffer.push({ name, value, id, rating: rate(name, value) });
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 1500);
    };

    let cls = 0;
    let clsId = `cls-${crypto.randomUUID()}`;

    const observers: PerformanceObserver[] = [];
    const observe = (type: string, cb: (e: PerformanceEntry) => void) => {
      try {
        const obs = new PerformanceObserver((list) => list.getEntries().forEach(cb));
        obs.observe({ type, buffered: true } as PerformanceObserverInit);
        observers.push(obs);
      } catch {
        /* unsupported metric — silently skip */
      }
    };

    observe('largest-contentful-paint', (e) => {
      report('LCP', e.startTime, `lcp-${e.startTime}`);
    });
    observe('first-input', (e) => {
      const fi = e as PerformanceEntry & { processingStart: number };
      report('FID', fi.processingStart - fi.startTime, `fid-${fi.startTime}`);
    });
    observe('layout-shift', (e) => {
      const ls = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!ls.hadRecentInput) {
        cls += ls.value;
        report('CLS', cls, clsId);
      }
    });
    observe('paint', (e) => {
      if (e.name === 'first-contentful-paint') {
        report('FCP', e.startTime, `fcp-${e.startTime}`);
      }
    });

    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries[0]) {
      const nav = navEntries[0] as PerformanceNavigationTiming;
      report('TTFB', nav.responseStart, `ttfb-${nav.responseStart}`);
    }

    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      observers.forEach((o) => o.disconnect());
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
  return null;
}
