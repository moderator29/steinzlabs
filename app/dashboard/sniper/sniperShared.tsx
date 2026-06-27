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

// ─── Token avatar (real logo → clean branded gradient fallback) ───────────────

const GRADIENTS: [string, string][] = [
  ['#0066FF', '#00D1FF'], ['#7C3AED', '#EC4899'], ['#F59E0B', '#EF4444'],
  ['#10B981', '#3B82F6'], ['#06B6D4', '#8B5CF6'], ['#F43F5E', '#FB923C'],
];
function gradientFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** Token avatar that uses the real logo and falls back to a clean, deterministic
 *  gradient monogram (never a plain gray box) when the token has no logo yet. */
export function TokenAvatar({ logo, symbol, address, size = 40 }: { logo?: string | null; symbol: string; address?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const [g1, g2] = gradientFor(address || symbol || '?');
  const initials = (symbol || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || (symbol || '?').slice(0, 2);
  if (logo && !failed) {
    return <img src={logo} alt={symbol} width={size} height={size} onError={() => setFailed(true)} className="rounded-full flex-shrink-0 object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${g1}, ${g2})`, fontSize: size * 0.34 }}
    >
      {initials}
    </div>
  );
}

// ─── Source / DEX presentation ────────────────────────────────────────────────

/** Brand color + short label for a DEX/source id. Self-contained (no external
 *  images that 404); renders as a colored monogram in a glass chip. */
export function sourceMeta(raw: string): { label: string; color: string; short: string } {
  const s = (raw || '').toLowerCase();
  const pick = (label: string, color: string) => ({ label, color, short: label.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() });
  if (s.includes('uniswap')) return pick(raw.replace(/_/g, ' '), '#FF007A');
  if (s.includes('pancake')) return pick(raw.replace(/_/g, ' '), '#33E6B5');
  if (s.includes('sushi')) return pick(raw.replace(/_/g, ' '), '#FA52A0');
  if (s.includes('quick')) return pick(raw.replace(/_/g, ' '), '#418ACA');
  if (s.includes('aerodrome')) return pick(raw.replace(/_/g, ' '), '#1E6BFF');
  if (s.includes('camelot')) return pick(raw.replace(/_/g, ' '), '#E0A857');
  if (s.includes('four') || s.includes('meme')) return pick(raw.replace(/_/g, ' '), '#F0B90B');
  if (s.includes('pump')) return pick(raw.replace(/_/g, ' '), '#22C55E');
  return pick(raw.replace(/_/g, ' '), '#6B7280');
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
