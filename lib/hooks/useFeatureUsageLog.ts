'use client';

import { useEffect, useRef } from 'react';

/**
 * Fire-and-forget feature usage logger. Mount this once at the top of
 * a top-level page component to feed the activity_score component of
 * the reputation scorer.
 *
 * Per-session in-memory dedupe: visiting the same page multiple times
 * within a single SPA navigation only writes one row. Different
 * feature_name keys log independently.
 *
 * Failure modes (network, 401, table missing) are swallowed silently
 * so a logging hiccup never blocks the page render.
 */
const fired = new Set<string>();

export function useFeatureUsageLog(featureName: string, action: string = 'view') {
  const onceRef = useRef(false);
  useEffect(() => {
    if (onceRef.current) return;
    onceRef.current = true;
    const dedupeKey = `${featureName}:${action}`;
    if (fired.has(dedupeKey)) return;
    fired.add(dedupeKey);
    void fetch('/api/feature-usage/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_name: featureName, action }),
      keepalive: true,
    }).catch(() => {});
  }, [featureName, action]);
}
