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
  score: number | null;
  scanned?: boolean;
  breakdown: { reputation: number; approvals: number; threats: number; honeypots: number };
  counts: { approvalDanger: number; threatCount: number; honeypotCount: number };
}

function ringColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

// Plain-language reason for the score so it never reads as an unexplained
// number. Names the actual issues found, or confirms the wallet is clean.
function healthReason(counts: { approvalDanger: number; threatCount: number; honeypotCount: number }): string {
  const issues: string[] = [];
  if (counts.approvalDanger > 0) issues.push(`${counts.approvalDanger} risky approval${counts.approvalDanger > 1 ? 's' : ''}`);
  if (counts.threatCount > 0) issues.push(`${counts.threatCount} threat alert${counts.threatCount > 1 ? 's' : ''} (30d)`);
  if (counts.honeypotCount > 0) issues.push(`${counts.honeypotCount} honeypot token${counts.honeypotCount > 1 ? 's' : ''} held`);
  if (issues.length === 0) return 'No dangerous approvals, active threats, or honeypots detected on the scans you have run.';
  return `Found: ${issues.join(' · ')}. Resolve these to raise your score.`;
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
    <div className="nl-glass rounded-2xl p-5 mb-6" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
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
                background: health?.score != null
                  ? `conic-gradient(${ringColor(health.score)} ${(health.score / 100) * 360}deg, rgba(255,255,255,0.06) 0deg)`
                  : 'rgba(255,255,255,0.06)',
              }}
            >
              <div className="w-[68px] h-[68px] rounded-full bg-[#05081E] flex items-center justify-center" style={{ color: health?.score != null ? ringColor(health.score) : '#64748b' }}>
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
            Driven by real wallet-security posture: approval risk (45%), threat alerts (30%), honeypot holdings (25%).
          </p>
          {health && health.score != null && (
            <>
              <p className="text-xs mt-1.5" style={{ color: ringColor(health.score) }}>
                {healthReason(health.counts)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                <Metric label="Approvals"  value={health.breakdown.approvals} />
                <Metric label="Threats"    value={health.breakdown.threats} />
                <Metric label="Honeypots"  value={health.breakdown.honeypots} />
              </div>
            </>
          )}
          {health && health.score == null && (
            <p className="text-xs mt-1.5 text-slate-400">
              Not scored yet — run an approval or token scan and your real security health appears here. We never show a &ldquo;clean&rdquo; score for a wallet that hasn&rsquo;t been scanned.
            </p>
          )}
        </div>
      </div>

      {!has2fa && (
        <Link
          href="/settings"
          className="nl-glass nl-glass--interactive mt-4 flex items-center gap-2 rounded-xl p-3 text-sm transition-colors" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}
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
    <div className="nl-card rounded-lg p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono font-semibold text-base mt-0.5" style={{ color: ringColor(value) }}>{value}</div>
    </div>
  );
}
