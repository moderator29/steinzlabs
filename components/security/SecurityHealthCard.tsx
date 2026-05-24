'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Loader2 } from 'lucide-react';
import Link from 'next/link';

/**
 * SC1 + SC3 surface: top-of-Security-Center card. Reads the composite
 * health score from /api/security/health and includes a 2FA-enable CTA
 * when the user hasn't enrolled yet.
 */

interface HealthResponse {
  score: number;
  breakdown: { reputation: number; approvals: number; threats: number; honeypots: number };
  counts: { approvalDanger: number; threatCount: number; honeypotCount: number };
}

function ringColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

export function SecurityHealthCard({ has2fa = false }: { has2fa?: boolean }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hRes = await fetch('/api/security/health');
        if (!cancelled && hRes.ok) setHealth(await hRes.json() as HealthResponse);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5 mb-6">
      <div className="flex items-start gap-5">
        <div className="relative shrink-0">
          {loading ? (
            <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl"
              style={{
                background: `conic-gradient(${ringColor(health?.score ?? 0)} ${((health?.score ?? 0) / 100) * 360}deg, rgba(255,255,255,0.06) 0deg)`,
              }}
            >
              <div className="w-[68px] h-[68px] rounded-full bg-[#05081E] flex items-center justify-center" style={{ color: ringColor(health?.score ?? 0) }}>
                {health?.score ?? '—'}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300" /> Security Health
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Composite of wallet reputation (50%), approval risk (20%), threat alerts (15%), and honeypot holdings (15%).
          </p>
          {health && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              <Metric label="Reputation" value={health.breakdown.reputation} />
              <Metric label="Approvals"  value={health.breakdown.approvals} />
              <Metric label="Threats"    value={health.breakdown.threats} />
              <Metric label="Honeypots"  value={health.breakdown.honeypots} />
            </div>
          )}
        </div>
      </div>

      {!has2fa && (
        <Link
          href="/settings/security"
          className="mt-4 flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/[0.05] p-3 text-sm hover:bg-blue-500/[0.08] transition-colors"
        >
          <KeyRound className="w-4 h-4 text-blue-300" />
          <div className="flex-1">
            <div className="font-semibold text-blue-200">Enable two-factor authentication</div>
            <div className="text-xs text-blue-300/80">Add a TOTP step before any wallet export or settings change.</div>
          </div>
          <ShieldAlert className="w-4 h-4 text-blue-300" />
        </Link>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/20 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono font-semibold text-base mt-0.5" style={{ color: ringColor(value) }}>{value}</div>
    </div>
  );
}
