'use client';
import { useEffect, useState } from 'react';

/**
 * Reads `(prefers-reduced-motion: reduce)` and listens for changes.
 * Defaults to `false` during SSR so the server-rendered HTML matches the
 * most common (motion-on) client; the effect re-syncs on hydrate.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
