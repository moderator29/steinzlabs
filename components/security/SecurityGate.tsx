'use client';

/**
 * §12 — Pre-trade security gate.
 *
 * Wraps a "Confirm Swap / Save Sniper / Copy Now" CTA button so the user
 * sees a unified risk readout (Trust Score + GoPlus contract analysis)
 * BEFORE the wallet prompt fires. Blocks low-trust trades by default,
 * with an explicit acknowledge step for high-risk overrides.
 *
 * Usage:
 *   <SecurityGate chain="ethereum" token="0x..." action="swap">
 *     <button onClick={execute}>Confirm Swap</button>
 *   </SecurityGate>
 *
 * Behavior:
 *  - score >= 60 (trusted+): renders the child CTA inline, no extra UI.
 *  - 40 <= score < 60 (caution): renders a small inline warning banner
 *    above the CTA; CTA stays clickable.
 *  - score < 40 (high_risk / dangerous): replaces the CTA with a
 *    "Review risk" button. Clicking opens a modal listing every red
 *    flag (honeypot, ownership, taxes, holder concentration). User
 *    must check "I understand the risk" before the original CTA
 *    re-appears.
 *  - score unknown (API down / no chain+token / non-EVM-non-Solana):
 *    fail-open — renders the CTA without a banner. Logs the gap.
 *
 * The Trust Score endpoint already handles caching + Solana case-
 * sensitivity; we re-use its public GET path verbatim. No new backend.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert, X } from 'lucide-react';

type Action = 'swap' | 'snipe' | 'copy';

interface Props {
  chain?: string;
  token?: string;
  action: Action;
  children: ReactNode;
  className?: string;
}

interface TrustScoreResponse {
  score: number;
  band: 'highly_trusted' | 'trusted' | 'caution' | 'high_risk' | 'dangerous';
  bandLabel: string;
  layers: { security: number; liquidity: number; holders: number; market: number; social: number };
  reasoning?: string[];
}

interface ContractAnalysis {
  riskLevel?: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
  flags?: string[];
  goplus?: { isHoneypot?: boolean; buyTax?: number; sellTax?: number; ownershipRenounced?: boolean };
}

const ACTION_VERBS: Record<Action, string> = {
  swap: 'swap',
  snipe: 'snipe',
  copy: 'copy-trade',
};

export function SecurityGate({ chain, token, action, children, className = '' }: Props) {
  const [score, setScore] = useState<TrustScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  // Reset acknowledgment whenever the token changes.
  useEffect(() => {
    setAcknowledged(false);
  }, [chain, token]);

  // Fetch the Trust Score. Fail-open: a missing chain/token, an API
  // outage, or a non-listed token all leave `score` null and the gate
  // renders the bare CTA.
  useEffect(() => {
    if (!chain || !token) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/trust-score/${encodeURIComponent(chain)}/${encodeURIComponent(token)}`);
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled) setScore(j);
      } catch {
        /* fail-open */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [chain, token]);

  // Lazy-fetch the heavier contract analyzer only when the user opens
  // the risk modal — keeps the trade-page bundle and request budget
  // small for the 80% case where Trust Score alone is enough.
  useEffect(() => {
    if (!showRiskModal || analysis !== null || !chain || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/security/contract-analyzer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: token, chain }),
        });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled) setAnalysis(j as ContractAnalysis);
      } catch {
        /* keep analysis null; modal still shows Trust Score data */
      }
    })();
    return () => { cancelled = true; };
  }, [showRiskModal, chain, token, analysis]);

  const band = score?.band;
  const isHighRisk = band === 'high_risk' || band === 'dangerous';
  const isCaution = band === 'caution';
  const blocked = isHighRisk && !acknowledged;

  // No token / unsupported chain → fail-open: render the original CTA.
  if (!chain || !token || !score) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {isCaution && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <span className="text-amber-200 font-semibold">Caution: </span>
            <span className="text-amber-100/90">Trust Score {score.score}/100. Review the risk before you {ACTION_VERBS[action]}.</span>
            <button onClick={() => setShowRiskModal(true)} className="ml-2 underline hover:text-white">View details</button>
          </div>
        </div>
      )}

      {blocked ? (
        <button
          type="button"
          onClick={() => setShowRiskModal(true)}
          aria-label={`Token Trust Score is ${score.score} out of 100 (${score.bandLabel}). Click to review risks before continuing.`}
          className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-red-500/15 border-2 border-red-500/40 text-red-200 hover:bg-red-500/25 transition-colors"
        >
          <ShieldAlert className="w-4 h-4" aria-hidden="true" />
          Review risk before {ACTION_VERBS[action]} ({score.score}/100)
        </button>
      ) : (
        <>
          {acknowledged && (
            <div role="status" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-200">
              <ShieldAlert className="w-3 h-3" aria-hidden="true" />
              Acknowledged: {score.bandLabel} ({score.score}/100). Trade proceeds at your risk.
            </div>
          )}
          {children}
        </>
      )}

      {showRiskModal && (
        <RiskModal
          score={score}
          analysis={analysis}
          chain={chain}
          token={token}
          action={action}
          isHighRisk={isHighRisk}
          onAcknowledge={() => { setAcknowledged(true); setShowRiskModal(false); }}
          onCancel={() => setShowRiskModal(false)}
        />
      )}

      {!score && loading && (
        <div className="text-[10px] text-gray-500">Checking trust score…</div>
      )}
    </div>
  );
}

function RiskModal({ score, analysis, chain, token, action, isHighRisk, onAcknowledge, onCancel }: {
  score: TrustScoreResponse;
  analysis: ContractAnalysis | null;
  chain: string;
  token: string;
  action: Action;
  isHighRisk: boolean;
  onAcknowledge: () => void;
  onCancel: () => void;
}) {
  const flags: string[] = [];
  if (analysis?.goplus?.isHoneypot) flags.push('Honeypot detected — sells may fail');
  if ((analysis?.goplus?.buyTax ?? 0) > 10) flags.push(`High buy tax: ${analysis!.goplus!.buyTax}%`);
  if ((analysis?.goplus?.sellTax ?? 0) > 10) flags.push(`High sell tax: ${analysis!.goplus!.sellTax}%`);
  if (analysis?.goplus?.ownershipRenounced === false) flags.push('Owner has not renounced — can change rules');
  if (Array.isArray(analysis?.flags)) for (const f of analysis.flags) flags.push(f);
  if (flags.length === 0 && isHighRisk) flags.push(`Composite Trust Score ${score.score}/100 (${score.bandLabel})`);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onCancel} role="dialog" aria-modal="true" aria-label="Token risk review">
      <div className="w-full max-w-md bg-[#0D1120] border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-300" aria-hidden="true" />
            <h2 className="text-sm font-bold text-white">Risk review</h2>
          </div>
          <button onClick={onCancel} aria-label="Close risk review" className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Naka Trust Score</span>
            <span className={`text-2xl font-bold ${isHighRisk ? 'text-red-300' : 'text-amber-300'}`}>{score.score}<span className="text-xs text-gray-500">/100</span></span>
          </div>
          <div className="text-xs text-gray-300">{score.bandLabel}</div>

          <div className="grid grid-cols-5 gap-1.5 text-[10px] text-center">
            {([
              ['security', score.layers.security],
              ['liquidity', score.layers.liquidity],
              ['holders', score.layers.holders],
              ['market', score.layers.market],
              ['social', score.layers.social],
            ] as const).map(([label, val]) => (
              <div key={label} className="bg-white/[0.04] rounded-lg p-2">
                <div className="text-gray-400 capitalize">{label}</div>
                <div className="text-white font-bold mt-0.5">{Math.round(val)}</div>
              </div>
            ))}
          </div>

          {flags.length > 0 && (
            <div className="space-y-1.5 text-xs">
              <div className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">Why we flagged this</div>
              <ul className="space-y-1">
                {flags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-red-200">
                    <ShieldAlert className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis === null && (
            <div className="text-[11px] text-gray-500">Loading deeper contract analysis…</div>
          )}

          <div className="text-[11px] text-gray-400 pt-2 border-t border-white/10">
            Token <span className="font-mono text-gray-300">{token.slice(0, 8)}…{token.slice(-6)}</span> on {chain}.
            You're about to {ACTION_VERBS[action]} a token rated <strong className="text-red-200">{score.bandLabel}</strong>.
            Past Trust Scores are no guarantee of future safety.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10 bg-white/[0.02]">
          <button onClick={onCancel} className="text-xs text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30">
            Cancel
          </button>
          {isHighRisk ? (
            <button
              onClick={onAcknowledge}
              className="text-xs font-semibold text-white bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              I understand the risk — let me {ACTION_VERBS[action]} anyway
            </button>
          ) : (
            <button
              onClick={onAcknowledge}
              className="text-xs font-semibold text-white bg-[#0A1EFF] hover:bg-[#0918CC] px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A1EFF]"
            >
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
