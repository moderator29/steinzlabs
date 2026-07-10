'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface CardSummary { card_index: number; viewed: number; next: number; skipClicked: number; skipConfirmed: number; completed: number }
interface VariantSummary { viewed: number; completed: number; skipConfirmed: number; completion_rate: number }
interface Analytics { window_days: number; cards: CardSummary[]; variants: { a: VariantSummary; b: VariantSummary } }

export default function OnboardingAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/onboarding/analytics', { headers: { Authorization: `Bearer ${sessionStorage.getItem('admin_token') ?? ''}` } });
        const json = await res.json();
        if (!res.ok) setError(json.error ?? 'Failed');
        else setData(json);
      } catch { setError('Network error'); }
    })();
  }, []);

  return (
    <div className="min-h-screen nl-aurora-bg p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Onboarding analytics</h1>
      <p className="text-[12px] text-slate-400 mb-5">Funnel over the last 30 days. Variants A/B compared side by side.</p>

      {error ? <div className="text-sm text-red-400">{error}</div>
        : data === null ? <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
        : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <VariantCard label="Variant A" v={data.variants.a} />
            <VariantCard label="Variant B" v={data.variants.b} />
          </div>

          <div className="rounded-2xl nl-glass overflow-hidden overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-start text-slate-400 uppercase text-[10px] border-b border-white/10">
                  <th className="px-3 py-2">Card</th>
                  <th className="px-3 py-2 text-end">Viewed</th>
                  <th className="px-3 py-2 text-end">Next</th>
                  <th className="px-3 py-2 text-end">Skip clicked</th>
                  <th className="px-3 py-2 text-end">Skip confirmed</th>
                  <th className="px-3 py-2 text-end">Completed</th>
                  <th className="px-3 py-2 text-end">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {data.cards.map((c) => {
                  const dropoff = c.viewed > 0 ? Math.round((1 - c.next / c.viewed) * 100) : 0;
                  return (
                    <tr key={c.card_index} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-3 py-2 text-white font-semibold">{c.card_index}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{c.viewed}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{c.next}</td>
                      <td className="px-3 py-2 text-end tabular-nums text-amber-300">{c.skipClicked}</td>
                      <td className="px-3 py-2 text-end tabular-nums text-red-300">{c.skipConfirmed}</td>
                      <td className="px-3 py-2 text-end tabular-nums text-emerald-300">{c.completed}</td>
                      <td className="px-3 py-2 text-end tabular-nums text-slate-300">{dropoff}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function VariantCard({ label, v }: { label: string; v: VariantSummary }) {
  return (
    <div className="rounded-2xl nl-glass p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-xl font-bold text-white tabular-nums mt-1">{(v.completion_rate * 100).toFixed(1)}%</div>
      <div className="text-[11px] text-slate-400">completion rate</div>
      <div className="mt-2 text-[11px] text-slate-300 tabular-nums">{v.viewed} viewed · {v.completed} completed · {v.skipConfirmed} skipped</div>
    </div>
  );
}
