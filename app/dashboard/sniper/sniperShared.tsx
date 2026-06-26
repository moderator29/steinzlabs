'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Lock } from 'lucide-react';

/**
 * Shared primitives for the Sniper terminal: feed token shape, formatting
 * helpers, and the lazy Shadow Guardian security-audit layer (concurrency
 * limited + cached so a dense feed never floods the upstream scanner).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectedToken {
  id: string; address: string; symbol: string; name: string; chain: string;
  liquidity: number; securityScore: number; status: 'safe' | 'risky' | 'blocked' | 'scanning' | 'sniped';
  detectedAt: number; price?: number; pairAge?: string; logo?: string;
  marketCap?: number; volume24h?: number; source?: string;
}

export interface TokenAudit {
  score: number;
  level: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
  honeypot: boolean;
  buyTax: number;
  sellTax: number;
  mintable: boolean;
  verified: boolean;
  lpLockedPct: number | null;
  blocked: boolean;
  flags: string[];
}

// ─── Formatting ─────────────────────────────────────────────────────────────

export function fmtUSD(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(2)}K`;
  return `${sign}$${a.toFixed(2)}`;
}

export function fmtCompact(n: number | undefined | null): string {
  if (n == null || !isFinite(n) || n === 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function shortAddr(a?: string | null): string {
  if (!a) return '—';
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

// ─── Shadow Guardian — lazy, concurrency-limited per-token audit ──────────────

const auditCache = new Map<string, TokenAudit>();
const auditInflight = new Map<string, Promise<TokenAudit | null>>();
let auditActive = 0;
const auditQueue: Array<() => void> = [];
const AUDIT_MAX_CONCURRENT = 3;

function auditSlot(): Promise<void> {
  if (auditActive < AUDIT_MAX_CONCURRENT) {
    auditActive++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => auditQueue.push(resolve)).then(() => { auditActive++; });
}
function auditRelease() {
  auditActive--;
  const next = auditQueue.shift();
  if (next) next();
}

async function fetchAudit(chain: string, address: string): Promise<TokenAudit | null> {
  const key = `${chain}:${address.toLowerCase()}`;
  const cached = auditCache.get(key);
  if (cached) return cached;
  const existing = auditInflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    await auditSlot();
    try {
      const res = await fetch(`/api/sniper/audit?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as TokenAudit;
      auditCache.set(key, data);
      return data;
    } catch {
      return null;
    } finally {
      auditRelease();
      auditInflight.delete(key);
    }
  })();
  auditInflight.set(key, p);
  return p;
}

export function useTokenAudit(chain: string, address: string): { audit: TokenAudit | null; loading: boolean } {
  const [audit, setAudit] = useState<TokenAudit | null>(() => auditCache.get(`${chain}:${address.toLowerCase()}`) ?? null);
  const [loading, setLoading] = useState(!audit);
  useEffect(() => {
    let alive = true;
    const cached = auditCache.get(`${chain}:${address.toLowerCase()}`);
    if (cached) { setAudit(cached); setLoading(false); return; }
    setLoading(true);
    fetchAudit(chain, address).then((a) => {
      if (!alive) return;
      setAudit(a);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [chain, address]);
  return { audit, loading };
}

/** Shadow Guardian badge cluster for a feed row. */
export function GuardianBadges({ audit, loading }: { audit: TokenAudit | null; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
        <Shield className="w-3 h-3 animate-pulse" /> Guardian scanning…
      </span>
    );
  }
  if (!audit) return null;

  const scoreColor = audit.level === 'SAFE' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
    : audit.level === 'CAUTION' ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
    : audit.level === 'WARNING' ? 'text-orange-300 bg-orange-500/15 border-orange-500/30'
    : 'text-red-300 bg-red-500/15 border-red-500/30';
  const taxHigh = audit.buyTax > 10 || audit.sellTax > 10;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${scoreColor}`} title="Shadow Guardian security score">
        <Shield className="w-2.5 h-2.5" />{audit.score}
      </span>
      {audit.honeypot && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border text-red-300 bg-red-500/15 border-red-500/40" title="Honeypot — cannot sell">
          <AlertTriangle className="w-2.5 h-2.5" />Honeypot
        </span>
      )}
      {(audit.buyTax > 0 || audit.sellTax > 0) && (
        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${taxHigh ? 'text-red-300 bg-red-500/10 border-red-500/30' : 'text-white/60 bg-white/[0.04] border-white/10'}`} title="Buy / Sell tax">
          {audit.buyTax}/{audit.sellTax}%
        </span>
      )}
      {audit.lpLockedPct != null && (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${audit.lpLockedPct >= 0.9 ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-amber-300 bg-amber-500/10 border-amber-500/30'}`} title="Liquidity locked / burned">
          <Lock className="w-2.5 h-2.5" />{Math.round(audit.lpLockedPct * 100)}%
        </span>
      )}
      {audit.mintable && (
        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold border text-amber-300 bg-amber-500/10 border-amber-500/30" title="Token is mintable">Mintable</span>
      )}
    </div>
  );
}
