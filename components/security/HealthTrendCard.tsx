'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, Loader2, Radar } from 'lucide-react';

/**
 * Health-score trend for the Security Center. Draws a sparkline from the
 * user's real persisted health-score snapshots (user_security_profile_history)
 * and shows the delta between the first and last point in the window. When
 * only a single snapshot exists there is no honest trend, so we show the
 * current score with an explicit "baseline set" note instead of a fake arrow.
 *
 * Also hosts the opt-in monitoring toggle, persisted to user_security_settings.
 */

interface Point {
  health_score: number;
  computed_at: string;
}

interface TrendResponse {
  points: Point[];
  current: number | null;
  delta: number | null;
  available: boolean;
}

function scoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

/** Build an SVG polyline from scores, normalized into the viewBox. */
function sparkPath(points: Point[], w: number, h: number): string {
  if (points.length < 2) return '';
  const scores = points.map((p) => p.health_score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  const stepX = w / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p.health_score - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function HealthTrendCard() {
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState<boolean | null>(null);
  const [savingMonitor, setSavingMonitor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tRes, mRes] = await Promise.all([
          fetch('/api/security/health/trend', { cache: 'no-store' }),
          fetch('/api/security/monitoring', { cache: 'no-store' }),
        ]);
        if (!cancelled && tRes.ok) setTrend(await tRes.json() as TrendResponse);
        if (!cancelled && mRes.ok) {
          const m = await mRes.json() as { enabled: boolean; available: boolean };
          setMonitoring(m.available ? m.enabled : null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggleMonitoring() {
    if (monitoring === null || savingMonitor) return;
    const next = !monitoring;
    setSavingMonitor(true);
    setMonitoring(next); // optimistic
    try {
      const res = await fetch('/api/security/monitoring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) setMonitoring(!next); // revert on failure
    } catch {
      setMonitoring(!next);
    } finally {
      setSavingMonitor(false);
    }
  }

  const points = trend?.points ?? [];
  const current = trend?.current ?? null;
  const delta = trend?.delta ?? null;
  const W = 200;
  const H = 44;
  const path = sparkPath(points, W, H);
  const lineColor = current !== null ? scoreColor(current) : '#8B7CFF';

  return (
    <div className="nl-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-[#8B7CFF]" aria-hidden="true" />
        <h2 className="text-base font-semibold">Health trend</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-3xl font-bold font-mono" style={{ color: current !== null ? scoreColor(current) : '#94A3B8' }}>
                {current ?? '…'}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">Current score</div>
            </div>

            {/* Sparkline only when a real multi-point series exists. */}
            {points.length >= 2 ? (
              <svg viewBox={`0 0 ${W} ${H}`} className="flex-1 h-11" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${path} L${W},${H} L0,${H} Z`} fill="url(#trendFill)" />
                <path d={path} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <div className="flex-1" />
            )}

            {/* Delta badge, honest single-snapshot handling. */}
            <div className="text-right">
              {delta === null ? (
                <div className="flex items-center gap-1 text-slate-500 text-xs justify-end">
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Baseline set</span>
                </div>
              ) : delta > 0 ? (
                <div className="flex items-center gap-1 text-emerald-400 text-sm font-semibold justify-end">
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  <span>+{delta}</span>
                </div>
              ) : delta < 0 ? (
                <div className="flex items-center gap-1 text-red-400 text-sm font-semibold justify-end">
                  <TrendingDown className="w-4 h-4" aria-hidden="true" />
                  <span>{delta}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-slate-400 text-sm font-semibold justify-end">
                  <Minus className="w-4 h-4" aria-hidden="true" />
                  <span>0</span>
                </div>
              )}
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
                {points.length >= 2 ? `over ${points.length} snapshots` : 'no history yet'}
              </div>
            </div>
          </div>

          {/* Opt-in monitoring toggle. Hidden entirely when the settings table
              isn't available, rather than showing a control that can't persist. */}
          {monitoring !== null && (
            <button
              type="button"
              onClick={() => void toggleMonitoring()}
              disabled={savingMonitor}
              className="nl-glass nl-glass--interactive mt-4 w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: monitoring ? 'rgba(0,102,255,0.14)' : 'rgba(148,163,184,0.1)' }}>
                <Radar className="w-4 h-4" style={{ color: monitoring ? '#0066FF' : '#94A3B8' }} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-100">Continuous monitoring</div>
                <div className="text-[11px] text-slate-500">
                  {monitoring ? 'Your wallet is being watched for new threats.' : 'Enable to log health snapshots and surface new alerts here.'}
                </div>
              </div>
              <span
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
                style={{ backgroundColor: monitoring ? '#0066FF' : 'rgba(148,163,184,0.3)' }}
                aria-hidden="true"
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{ transform: monitoring ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
