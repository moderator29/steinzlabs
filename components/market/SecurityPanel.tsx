'use client';

/**
 * SecurityPanel — DexScreener / Birdeye / MEVX-parity safety panel for
 * the token detail page.
 *
 * Source of truth: /api/security/scan (POST) which calls GoPlus
 * Token Security and folds the response into a Naka Trust Score plus a
 * structured `raw` payload. We surface the high-signal fields users
 * scan before pressing Buy — holder count, top-holder concentration,
 * mint / freeze authority, honeypot status, liquidity-lock signal,
 * sell tax, and the raw reasons list.
 *
 * Audit P0 #5 — without this panel, users have no way to spot rugs or
 * honeypots from the platform's own UI; they have to leave and check
 * GoPlus / DexScreener directly.
 */

import { useEffect, useState } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX, Users,
  AlertTriangle, ExternalLink, Loader2, RefreshCw, CheckCircle2, XCircle,
} from 'lucide-react';
import { LpLockPanel } from '@/components/security/LpLockPanel';
import { TriangulationBadgeStack } from '@/components/security/TriangulationBadgeStack';
import { DeployerHistoryPanel } from '@/components/security/DeployerHistoryPanel';
import { evaluateLpLock, type LpLockRecord } from '@/lib/security/lpLockWindow';

interface TriangulationResponse {
  verdict: {
    honeypot: boolean;
    confidence: 'high' | 'medium' | 'low';
    honeypotSources: string[];
    safeSources: string[];
  };
}

interface DeployerResponse {
  available: boolean;
  trustScore?: number;
  band?: 'pristine' | 'clean' | 'caution' | 'dangerous' | 'serial-rugger';
  totalDeployed?: number;
  rugged?: number;
  abandoned?: number;
  active?: number;
}

interface SecurityScanResponse {
  scan_type: 'token';
  target: string;
  chain: string;
  score: number;
  level: 'safe' | 'warning' | 'danger' | 'critical' | string;
  reasons: string[];
  raw: Record<string, unknown>;
}

interface Props {
  chain: string;
  address: string;
  // Liquidity USD from the DexScreener pair payload — used for the
  // low-liquidity flag when GoPlus doesn't surface one explicitly.
  liquidityUsd?: number | null;
}

const LEVEL_TONE: Record<string, { bg: string; text: string; border: string; Icon: typeof Shield }> = {
  safe: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', Icon: ShieldCheck },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', Icon: ShieldAlert },
  danger: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', Icon: ShieldAlert },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', Icon: ShieldX },
};

function toneFor(level: string) {
  return LEVEL_TONE[level] ?? LEVEL_TONE.warning;
}

/**
 * GoPlus EVM token-security flags use string "1" / "0" for booleans.
 * Solana payload uses different shapes (mint authority is an address or
 * `null`). normalizeFlag returns true ONLY for the unambiguous bad
 * states so we don't false-positive on missing fields.
 */
function isFlagOn(value: unknown): boolean {
  if (value === '1' || value === 1 || value === true) return true;
  return false;
}

function isFlagOff(value: unknown): boolean {
  if (value === '0' || value === 0 || value === false) return true;
  return false;
}

interface FactRow {
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
  hint?: string;
}

function readEvmFacts(raw: Record<string, unknown>): FactRow[] {
  const facts: FactRow[] = [];

  // Holders + concentration
  const holderCount = Number(raw.holder_count ?? 0);
  if (holderCount > 0) {
    facts.push({
      label: 'Holders',
      value: holderCount.toLocaleString(),
      tone: holderCount < 100 ? 'warn' : holderCount < 500 ? 'neutral' : 'good',
      hint: holderCount < 100 ? 'Very few holders — high single-wallet risk.' : undefined,
    });
  }
  const holders = Array.isArray(raw.holders) ? raw.holders as Array<{ percent?: string | number }> : [];
  if (holders.length > 0) {
    const top10 = holders.slice(0, 10).reduce((sum, h) => sum + (Number(h.percent ?? 0) * 100), 0);
    if (top10 > 0) {
      facts.push({
        label: 'Top 10 hold',
        value: `${top10.toFixed(1)}%`,
        tone: top10 > 70 ? 'bad' : top10 > 50 ? 'warn' : 'good',
        hint: top10 > 70 ? 'Top 10 wallets control most supply — coordinated dump risk.' : undefined,
      });
    }
  }

  // Mint / freeze / pause authority
  if (raw.is_mintable !== undefined) {
    facts.push({
      label: 'Mintable',
      value: isFlagOn(raw.is_mintable) ? 'Yes' : 'No',
      tone: isFlagOn(raw.is_mintable) ? 'bad' : 'good',
      hint: isFlagOn(raw.is_mintable) ? 'Owner can mint new supply at will.' : undefined,
    });
  }
  if (raw.transfer_pausable !== undefined) {
    facts.push({
      label: 'Transfer pausable',
      value: isFlagOn(raw.transfer_pausable) ? 'Yes' : 'No',
      tone: isFlagOn(raw.transfer_pausable) ? 'bad' : 'good',
      hint: isFlagOn(raw.transfer_pausable) ? 'Owner can freeze all transfers.' : undefined,
    });
  }
  if (raw.is_blacklisted !== undefined) {
    facts.push({
      label: 'Blacklist function',
      value: isFlagOn(raw.is_blacklisted) ? 'Yes' : 'No',
      tone: isFlagOn(raw.is_blacklisted) ? 'bad' : 'good',
      hint: isFlagOn(raw.is_blacklisted) ? 'Owner can blacklist holders.' : undefined,
    });
  }

  // Honeypot
  if (raw.is_honeypot !== undefined) {
    facts.push({
      label: 'Honeypot',
      value: isFlagOn(raw.is_honeypot) ? 'YES — DO NOT BUY' : 'No',
      tone: isFlagOn(raw.is_honeypot) ? 'bad' : 'good',
    });
  }
  if (raw.cannot_sell_all !== undefined && isFlagOn(raw.cannot_sell_all)) {
    facts.push({
      label: 'Sell restriction',
      value: 'Cannot sell entire balance',
      tone: 'bad',
      hint: 'Honeypot pattern — partial sells only.',
    });
  }

  // Tax
  const buyTax = Number(raw.buy_tax ?? 0) * 100;
  const sellTax = Number(raw.sell_tax ?? 0) * 100;
  if (buyTax > 0 || sellTax > 0) {
    facts.push({
      label: 'Buy / sell tax',
      value: `${buyTax.toFixed(1)}% / ${sellTax.toFixed(1)}%`,
      tone: sellTax > 10 || buyTax > 10 ? 'bad' : sellTax > 5 || buyTax > 5 ? 'warn' : 'neutral',
      hint: sellTax > 10 ? 'Sell tax above 10% is unusually predatory.' : undefined,
    });
  }
  if (isFlagOn(raw.slippage_modifiable)) {
    facts.push({
      label: 'Slippage modifiable',
      value: 'Yes',
      tone: 'warn',
      hint: 'Owner can change tax / slippage at any time.',
    });
  }

  // Verified / open source
  if (raw.is_open_source !== undefined) {
    facts.push({
      label: 'Source verified',
      value: isFlagOn(raw.is_open_source) ? 'Yes' : 'No',
      tone: isFlagOn(raw.is_open_source) ? 'good' : 'warn',
      hint: !isFlagOn(raw.is_open_source) ? 'Contract source is not published — cannot audit.' : undefined,
    });
  }
  if (raw.is_proxy !== undefined && isFlagOn(raw.is_proxy)) {
    facts.push({
      label: 'Upgradeable proxy',
      value: 'Yes',
      tone: 'warn',
      hint: 'Logic can change after deployment.',
    });
  }

  // Liquidity / LP lock
  const lpHolders = Array.isArray(raw.lp_holders) ? raw.lp_holders as Array<{ is_locked?: number | string; percent?: string | number; address?: string; tag?: string }> : [];
  if (lpHolders.length > 0) {
    const lockedPct = lpHolders.reduce((sum, h) => sum + (isFlagOn(h.is_locked) ? Number(h.percent ?? 0) * 100 : 0), 0);
    facts.push({
      label: 'LP locked',
      value: `${lockedPct.toFixed(1)}%`,
      tone: lockedPct >= 80 ? 'good' : lockedPct >= 50 ? 'warn' : 'bad',
      hint: lockedPct < 50 ? 'Most LP is unlocked — rug-pull risk.' : undefined,
    });
  }

  return facts;
}

function readSolanaFacts(raw: Record<string, unknown>): FactRow[] {
  const facts: FactRow[] = [];
  const mintAuth = raw.metadata_mutable as { status?: number | string } | undefined;
  const freezeAuth = raw.freezable as { status?: number | string } | undefined;
  const closable = raw.closable as { status?: number | string } | undefined;
  const nonTransferable = raw.non_transferable;

  if (mintAuth?.status !== undefined) {
    facts.push({
      label: 'Mint authority',
      value: isFlagOff(mintAuth.status) ? 'Renounced' : 'Active',
      tone: isFlagOff(mintAuth.status) ? 'good' : 'bad',
      hint: !isFlagOff(mintAuth.status) ? 'Mint authority active — supply can be inflated.' : undefined,
    });
  }
  if (freezeAuth?.status !== undefined) {
    facts.push({
      label: 'Freeze authority',
      value: isFlagOff(freezeAuth.status) ? 'Renounced' : 'Active',
      tone: isFlagOff(freezeAuth.status) ? 'good' : 'bad',
      hint: !isFlagOff(freezeAuth.status) ? 'Freeze authority active — your tokens can be frozen.' : undefined,
    });
  }
  if (closable?.status !== undefined && isFlagOn(closable.status)) {
    facts.push({
      label: 'Account closable',
      value: 'Yes',
      tone: 'warn',
      hint: 'Owner can close holder accounts.',
    });
  }
  if (isFlagOn(nonTransferable)) {
    facts.push({
      label: 'Non-transferable',
      value: 'Yes',
      tone: 'bad',
    });
  }
  const holders = Array.isArray(raw.holders) ? raw.holders as Array<{ percent?: string | number }> : [];
  if (holders.length > 0) {
    const top10 = holders.slice(0, 10).reduce((sum, h) => sum + (Number(h.percent ?? 0) * 100), 0);
    if (top10 > 0) {
      facts.push({
        label: 'Top 10 hold',
        value: `${top10.toFixed(1)}%`,
        tone: top10 > 70 ? 'bad' : top10 > 50 ? 'warn' : 'good',
      });
    }
  }
  return facts;
}

export default function SecurityPanel({ chain, address, liquidityUsd }: Props) {
  const [data, setData] = useState<SecurityScanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triangulation, setTriangulation] = useState<TriangulationResponse['verdict'] | null>(null);
  const [deployer, setDeployer] = useState<DeployerResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/security/triangulation?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(address)}`);
        if (!res.ok) return;
        const json = (await res.json()) as TriangulationResponse;
        if (!cancelled) setTriangulation(json.verdict);
      } catch { /* triangulation unavailable — panel hides */ }
    })();
    (async () => {
      try {
        const res = await fetch(`/api/security/deployer-history?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(address)}`);
        if (!res.ok) return;
        const json = (await res.json()) as DeployerResponse;
        if (!cancelled) setDeployer(json);
      } catch { /* deployer history unavailable */ }
    })();
    return () => { cancelled = true; };
  }, [chain, address]);

  const scan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_type: 'token', target: address, chain }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => 'Scan failed');
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as SecurityScanResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, address]);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Running on-chain security scan…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Shield className="w-3.5 h-3.5" />
            Security scan unavailable
          </div>
          <button
            type="button"
            onClick={scan}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900/60 hover:bg-slate-800 text-slate-300"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
        {error && <div className="mt-1.5 text-[10px] text-slate-400">{error}</div>}
      </div>
    );
  }

  const tone = toneFor(data.level);
  const ToneIcon = tone.Icon;
  const facts = chain === 'solana' ? readSolanaFacts(data.raw) : readEvmFacts(data.raw);

  // Derive LP lock records from GoPlus lp_holders (EVM only).
  let lpLockRecords: LpLockRecord[] = [];
  if (chain !== 'solana') {
    const rawHolders = Array.isArray(data.raw.lp_holders)
      ? (data.raw.lp_holders as Array<{
          is_locked?: number | string;
          percent?: string | number;
          tag?: string;
          address?: string;
          locked_detail?: Array<{ end_time?: string | number; amount?: string | number }>;
        }>)
      : [];
    for (const h of rawHolders) {
      if (!isFlagOn(h.is_locked)) continue;
      const share = Number(h.percent ?? 0);
      if (!isFinite(share) || share <= 0) continue;
      const lockerTag = (h.tag ?? '').toLowerCase();
      const locker: LpLockRecord['locker'] =
        lockerTag.includes('team finance') ? 'team-finance'
        : lockerTag.includes('unicrypt') ? 'unicrypt'
        : lockerTag.includes('pinklock') ? 'pinklock'
        : 'other';
      const details = Array.isArray(h.locked_detail) ? h.locked_detail : [];
      if (details.length === 0) {
        lpLockRecords.push({ locker, unlockAt: Math.floor(Date.now() / 1000) + 10 * 365 * 86400, lpShare: share, owner: h.address ?? null });
        continue;
      }
      for (const d of details) {
        const end = Number(d.end_time ?? 0);
        if (!isFinite(end) || end <= 0) continue;
        const portion = Number(d.amount ?? 0);
        const effectiveShare = portion > 0 && portion <= 1 ? portion : share / details.length;
        lpLockRecords.push({ locker, unlockAt: end, lpShare: effectiveShare, owner: h.address ?? null });
      }
    }
  }
  const lpVerdict = lpLockRecords.length > 0 ? evaluateLpLock(lpLockRecords) : null;

  // Tack on a generic low-liquidity flag from the DexScreener pair
  // payload — GoPlus doesn't surface this directly and it's one of the
  // easiest rug indicators a trader can read.
  if (typeof liquidityUsd === 'number') {
    facts.push({
      label: 'Pool liquidity',
      value: `$${liquidityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      tone: liquidityUsd < 10_000 ? 'bad' : liquidityUsd < 50_000 ? 'warn' : 'good',
      hint: liquidityUsd < 10_000 ? 'Very thin liquidity — large orders will move price heavily.' : undefined,
    });
  }

  return (
    <div className={`rounded-xl border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ToneIcon className={`w-4 h-4 ${tone.text}`} />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
            Security
          </span>
          <span
            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${tone.text} ${tone.border}`}
            title="Naka Trust Score (0-100). Higher is safer. Combines GoPlus contract audit signals with liquidity and holder distribution."
          >
            {data.score}/100 · {data.level.toUpperCase()}
          </span>
        </div>
        <button
          type="button"
          onClick={scan}
          className="text-[10px] inline-flex items-center gap-1 text-slate-400 hover:text-slate-200"
          title="Re-run scan"
        >
          <RefreshCw className="w-3 h-3" />
          Re-scan
        </button>
      </div>

      {facts.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {facts.map((f) => (
            <div
              key={f.label}
              className="flex items-start justify-between gap-2 rounded-lg bg-slate-950/40 border border-slate-800/60 px-2.5 py-2"
              title={f.hint}
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">{f.label}</div>
                <div
                  className={`text-xs font-semibold tabular-nums ${
                    f.tone === 'good' ? 'text-emerald-400'
                      : f.tone === 'bad' ? 'text-red-400'
                      : f.tone === 'warn' ? 'text-amber-400'
                      : 'text-slate-200'
                  }`}
                >
                  {f.value}
                </div>
              </div>
              {f.tone === 'good' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70 mt-0.5 shrink-0" />
                : f.tone === 'bad' ? <XCircle className="w-3.5 h-3.5 text-red-500/70 mt-0.5 shrink-0" />
                : f.tone === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 mt-0.5 shrink-0" />
                : null}
            </div>
          ))}
        </div>
      )}

      {triangulation && (
        <div className="mb-3 flex items-center gap-2">
          <TriangulationBadgeStack
            honeypot={triangulation.honeypot}
            confidence={triangulation.confidence}
            honeypotSources={triangulation.honeypotSources}
            safeSources={triangulation.safeSources}
          />
          <span className="text-[10px] text-slate-400">Source triangulation</span>
        </div>
      )}

      {lpVerdict && (
        <div className="mb-3">
          <LpLockPanel
            totalLockedPct={lpVerdict.totalLockedPct}
            soonestUnlockAt={lpVerdict.soonestUnlockAt}
            daysUntilUnlock={lpVerdict.daysUntilUnlock}
            severity={lpVerdict.severity}
            byLocker={lpVerdict.byLocker}
          />
        </div>
      )}

      {deployer?.available && deployer.band && (
        <div className="mb-3">
          <DeployerHistoryPanel
            trustScore={deployer.trustScore ?? 0}
            totalDeployed={deployer.totalDeployed ?? 0}
            rugged={deployer.rugged ?? 0}
            abandoned={deployer.abandoned ?? 0}
            active={deployer.active ?? 0}
            band={deployer.band}
          />
        </div>
      )}

      {/* §holder-distribution-panel — GoPlus already returns a holders[]
          array with address + percent + is_contract + is_locked + tag.
          The panel used to show only a single top-10 % number; this
          renders the full top-10 breakdown with horizontal bars,
          contract / locked / tagged badges, and short-form addresses
          linked to the chain explorer. Matches Birdeye / DexScreener. */}
      {data && (() => {
        type RawHolder = {
          address?: string;
          percent?: string | number;
          is_contract?: number | string;
          is_locked?: number | string;
          tag?: string;
        };
        const raw = (data.raw as Record<string, unknown>) ?? {};
        const holders = (Array.isArray(raw.holders) ? raw.holders as RawHolder[] : []).slice(0, 10);
        if (holders.length === 0) return null;
        return (
          <div className="mb-3 rounded-2xl border border-slate-800/50 bg-slate-950/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Top 10 Holders</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {holders.reduce((s, h) => s + Number(h.percent ?? 0) * 100, 0).toFixed(1)}% combined
              </span>
            </div>
            <ul className="space-y-1.5">
              {holders.map((h, i) => {
                const pct = Math.max(0, Math.min(100, Number(h.percent ?? 0) * 100));
                const isContract = Number(h.is_contract ?? 0) === 1;
                const isLocked = Number(h.is_locked ?? 0) === 1;
                const addr = h.address ?? '';
                const shortAddr = addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
                return (
                  <li key={`${addr}:${i}`} className="text-[11px]">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-slate-600 w-4 text-end">#{i + 1}</span>
                        <span className="font-mono text-slate-300 truncate">{h.tag || shortAddr}</span>
                        {isLocked && (
                          <span className="flex-shrink-0 text-[8px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold uppercase tracking-wider">Locked</span>
                        )}
                        {isContract && !isLocked && (
                          <span className="flex-shrink-0 text-[8px] px-1 py-0.5 rounded bg-slate-700/40 text-slate-300 border border-slate-600/30 font-bold uppercase tracking-wider">Contract</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-200 tabular-nums">{pct.toFixed(2)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-1 rounded-full bg-gradient-to-r from-[#0066FF] to-[#7C3AED]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      {data.reasons.length > 0 && (
        <div className="rounded-lg bg-slate-950/40 border border-slate-800/60 px-3 py-2 mb-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Findings</div>
          <ul className="space-y-1">
            {data.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                <span className="text-slate-400">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Users className="w-3 h-3" /> Source: GoPlus + DEX
        </span>
        <a
          href={`https://gopluslabs.io/token-security/${chain}/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200"
        >
          GoPlus report <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
