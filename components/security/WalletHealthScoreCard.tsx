'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Loader2, AlertTriangle, Share2, Check, Info } from 'lucide-react';

/**
 * Shareable wallet health score card (Webacy-style). Reads the transparent
 * 0..100 composite from /api/security/wallet-health for ANY looked-up wallet
 * and renders the score ring, per-component breakdown, and the concrete real
 * signals behind it. Includes a compact shareable variant with a copy-link
 * action. Honest empty / partial states — never fabricated numbers.
 */

interface SubScore {
  score: number | null;
  weight: number;
  available: boolean;
  detail: string;
}

interface HealthResult {
  address: string;
  chain: string;
  score: number | null;
  band: 'healthy' | 'moderate' | 'risky' | 'critical' | 'unknown';
  coverage: number;
  components: {
    approvals: SubScore;
    honeypot: SubScore;
    sanctions: SubScore;
    activity: SubScore;
  };
  signals: {
    riskyApprovals: number;
    unlimitedApprovals: number;
    totalApprovals: number;
    honeypotTokens: number;
    highTaxTokens: number;
    holdingsScanned: number;
    sanctioned: boolean;
    walletAgeDays: number | null;
    txCount: number | null;
  };
  notes: string[];
  computedAt: string;
}

const BAND_COLOR: Record<HealthResult['band'], string> = {
  healthy: '#10B981',
  moderate: '#F59E0B',
  risky: '#F97316',
  critical: '#EF4444',
  unknown: '#64748B',
};

const BAND_LABEL: Record<HealthResult['band'], string> = {
  healthy: 'Healthy',
  moderate: 'Moderate',
  risky: 'Risky',
  critical: 'Critical',
  unknown: 'Unknown',
};

function shortAddr(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

const COMPONENT_LABELS: Record<string, string> = {
  approvals: 'Approvals',
  honeypot: 'Holdings',
  sanctions: 'Sanctions',
  activity: 'Activity',
};

export function WalletHealthScoreCard({
  address,
  chain = 'ethereum',
  compact = false,
}: {
  address: string;
  chain?: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/security/wallet-health?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error ?? 'Failed to compute wallet health');
        } else {
          setData(json as HealthResult);
        }
      } catch {
        if (!cancelled) setError('Failed to reach the health scorer');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address, chain]);

  const share = useCallback(async () => {
    const url = `${window.location.origin}/dashboard/security/wallet-analysis?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}`;
    const scoreText = data?.score !== null && data?.score !== undefined
      ? `Wallet health ${data.score}/100 (${BAND_LABEL[data.band]})`
      : 'Wallet health score';
    const text = `${scoreText} for ${shortAddr(address)} · Naka Labs`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Wallet Health', text, url });
        return;
      }
    } catch { /* user dismissed or share unsupported — fall through to copy */ }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — no-op */ }
  }, [address, chain, data]);

  const ring = BAND_COLOR[data?.band ?? 'unknown'];
  const pct = data?.score ?? 0;

  if (loading) {
    return (
      <div className="nl-glass rounded-2xl p-5" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin text-[#0066FF]" aria-hidden="true" />
          Computing wallet health from live signals…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nl-glass rounded-2xl p-5" style={{ boxShadow: '0 0 0 1px rgba(239,68,68,.35), 0 0 16px rgba(239,68,68,.15)' }}>
        <div className="flex items-center gap-2 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const ScoreRing = (
    <div className="relative shrink-0">
      <div
        className="rounded-full flex items-center justify-center font-bold"
        style={{
          width: compact ? 64 : 88,
          height: compact ? 64 : 88,
          background: `conic-gradient(${ring} ${(pct / 100) * 360}deg, rgba(255,255,255,0.06) 0deg)`,
        }}
      >
        <div
          className="rounded-full bg-[#05081E] flex flex-col items-center justify-center"
          style={{ width: compact ? 54 : 76, height: compact ? 54 : 76, color: ring }}
        >
          <span style={{ fontSize: compact ? 20 : 28, lineHeight: 1 }}>
            {data.score ?? '?'}
          </span>
          {!compact && <span className="text-[9px] uppercase tracking-wider text-gray-500 mt-0.5">/ 100</span>}
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div
        className="nl-glass nl-glass--interactive rounded-2xl p-4 flex items-center gap-4 nl-fade-up"
        style={{ boxShadow: `0 0 0 1px ${ring}55, 0 0 18px ${ring}22` }}
      >
        {ScoreRing}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: ring }} aria-hidden="true" />
            <span className="text-sm font-semibold" style={{ color: ring }}>{BAND_LABEL[data.band]}</span>
            <span className="text-[10px] font-mono text-gray-500">{shortAddr(data.address)}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 truncate">
            {data.signals.riskyApprovals} risky approvals · {data.signals.honeypotTokens} honeypot holdings
            {data.signals.sanctioned ? ' · OFAC sanctioned' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={share}
          className="nl-btn-neon px-3 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shrink-0"
          aria-label="Share wallet health"
        >
          {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Share2 className="w-3.5 h-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>
    );
  }

  return (
    <div
      className="nl-glass rounded-2xl p-5 nl-fade-up"
      style={{ boxShadow: `0 0 0 1px ${ring}55, 0 0 18px ${ring}22` }}
    >
      <div className="flex items-start gap-5">
        {ScoreRing}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: ring }} aria-hidden="true" />
              Wallet Health
              <span className="text-xs font-semibold" style={{ color: ring }}>{BAND_LABEL[data.band]}</span>
            </h3>
            <button
              type="button"
              onClick={share}
              className="nl-btn-neon px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
              aria-label="Share wallet health"
            >
              {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Share2 className="w-3.5 h-3.5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Transparent 0 to 100 score from open approvals (35%), holdings honeypot exposure (30%),
            OFAC sanctions (20%), and wallet age &amp; activity (15%).
            {data.coverage < 1 && (
              <span className="text-amber-300/90"> {Math.round(data.coverage * 100)}% source coverage.</span>
            )}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {(Object.entries(data.components) as [string, SubScore][]).map(([key, c]) => (
              <div key={key} className="nl-glass rounded-lg p-2" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,.04)' }}>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">{COMPONENT_LABELS[key] ?? key}</div>
                <div
                  className="font-mono font-semibold text-base mt-0.5"
                  style={{ color: c.available && c.score !== null ? BAND_COLOR[bandForScore(c.score)] : '#64748B' }}
                >
                  {c.available && c.score !== null ? c.score : 'n/a'}
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{c.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Signal label="Risky approvals" value={String(data.signals.riskyApprovals)} danger={data.signals.riskyApprovals > 0} />
        <Signal label="Honeypot holdings" value={String(data.signals.honeypotTokens)} danger={data.signals.honeypotTokens > 0} />
        <Signal label="OFAC sanctioned" value={data.signals.sanctioned ? 'Yes' : 'No'} danger={data.signals.sanctioned} />
        <Signal
          label="Wallet age"
          value={data.signals.walletAgeDays === null ? 'Unknown' : `${data.signals.walletAgeDays}d`}
          danger={data.signals.walletAgeDays !== null && data.signals.walletAgeDays < 14}
        />
      </div>

      {data.notes.length > 0 && (
        <div className="mt-3 flex items-start gap-1.5 text-[10px] text-amber-300/80">
          <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{data.notes.join(' ')}</span>
        </div>
      )}
    </div>
  );
}

function bandForScore(score: number): HealthResult['band'] {
  if (score >= 80) return 'healthy';
  if (score >= 55) return 'moderate';
  if (score >= 30) return 'risky';
  return 'critical';
}

function Signal({ label, value, danger }: { label: string; value: string; danger: boolean }) {
  return (
    <div className="nl-glass rounded-lg p-2" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,.04)' }}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`font-mono font-semibold text-sm mt-0.5 ${danger ? 'text-red-300' : 'text-gray-200'}`}>{value}</div>
    </div>
  );
}
