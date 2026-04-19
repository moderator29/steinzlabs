'use client';

// Phase 6 — WhaleDetailDrawer
// Slide-in panel with: portrait, entity badges (Arkham-enriched), key metrics,
// recent activity feed (DB or live Alchemy/Helius), social links, follow CTA.

import { useEffect, useState } from 'react';
import { X, ExternalLink, CheckCircle2, TrendingUp, TrendingDown, Copy, Check, Loader2, Globe, Twitter, Users, Activity, Wallet } from 'lucide-react';

interface WhaleRow {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  entity_type: string | null;
  archetype: string | null;
  portfolio_value_usd: string | number | null;
  pnl_7d_usd?: string | number | null;
  pnl_30d_usd: string | number | null;
  pnl_90d_usd?: string | number | null;
  win_rate: string | number | null;
  whale_score: number | null;
  trade_count_30d: number | null;
  avg_hold_hours?: string | number | null;
  follower_count: number | null;
  x_handle: string | null;
  tg_handle?: string | null;
  website?: string | null;
  verified: boolean;
  last_active_at: string | null;
  first_seen_at?: string | null;
}

interface ArkhamLabel {
  entity: string | null;
  type: string | null;
  verified: boolean;
  logo: string | null;
  website: string | null;
  twitter: string | null;
  labels: string[];
}

interface ActivityRow {
  tx_hash: string;
  from_address: string | null;
  to_address: string | null;
  value: number | null;
  token_symbol: string | null;
  direction: 'in' | 'out' | 'unknown';
  chain: string;
  block_number: number | string | null;
  timestamp: string | null;
  source?: string;
}

interface DetailResponse {
  whale: WhaleRow;
  arkham: ArkhamLabel | null;
  activity: ActivityRow[];
  followerCount: number;
  source: 'db' | 'live';
}

function explorerUrl(chain: string, address: string): string {
  switch (chain) {
    case 'ethereum': return `https://etherscan.io/address/${address}`;
    case 'base': return `https://basescan.org/address/${address}`;
    case 'arbitrum': return `https://arbiscan.io/address/${address}`;
    case 'optimism': return `https://optimistic.etherscan.io/address/${address}`;
    case 'bsc': return `https://bscscan.com/address/${address}`;
    case 'polygon': return `https://polygonscan.com/address/${address}`;
    case 'avalanche': return `https://snowtrace.io/address/${address}`;
    case 'solana': return `https://solscan.io/account/${address}`;
    default: return `https://etherscan.io/address/${address}`;
  }
}

function txUrl(chain: string, hash: string): string {
  switch (chain) {
    case 'solana': return `https://solscan.io/tx/${hash}`;
    case 'bsc': return `https://bscscan.com/tx/${hash}`;
    case 'polygon': return `https://polygonscan.com/tx/${hash}`;
    case 'avalanche': return `https://snowtrace.io/tx/${hash}`;
    case 'base': return `https://basescan.org/tx/${hash}`;
    case 'arbitrum': return `https://arbiscan.io/tx/${hash}`;
    case 'optimism': return `https://optimistic.etherscan.io/tx/${hash}`;
    default: return `https://etherscan.io/tx/${hash}`;
  }
}

function fmtUsd(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n) || n === 0) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function short(a: string): string { return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86_400)}d ago`;
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return `hsl(${h % 360} 65% 55%)`;
}

export default function WhaleDetailDrawer({
  whale,
  onClose,
  onFollow,
}: {
  whale: WhaleRow;
  onClose: () => void;
  onFollow: () => void;
}) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    fetch(`/api/whales/${whale.address}?chain=${whale.chain}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setErr(String(e?.message || e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [whale.address, whale.chain]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const copyAddress = () => {
    navigator.clipboard.writeText(whale.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const w = detail?.whale || whale;
  const ark = detail?.arkham;
  const activity = detail?.activity || [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative ml-auto w-full max-w-lg h-full bg-[#05081E] border-l border-white/10 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#05081E]/95 backdrop-blur px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black text-white shrink-0"
            style={{ background: avatarColor(w.label || w.address) }}
          >
            {(w.label || w.address).slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold truncate">{w.label || short(w.address)}</h2>
              {(w.verified || ark?.verified) && <CheckCircle2 className="w-4 h-4 text-[#0A1EFF] shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 uppercase">{w.chain}</span>
              {w.archetype && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{w.archetype}</span>}
              {ark?.entity && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0A1EFF]/20 text-[#8FA3FF]">Entity: {ark.entity}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Address row */}
        <div className="px-5 py-3 flex items-center gap-2 bg-white/[0.02]">
          <Wallet className="w-3.5 h-3.5 text-slate-500" />
          <code className="flex-1 text-xs font-mono text-slate-300 truncate">{w.address}</code>
          <button onClick={copyAddress} className="p-1.5 rounded hover:bg-white/5">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          <a href={explorerUrl(w.chain, w.address)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-white/5" aria-label="Explorer">
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>

        {/* Metrics */}
        <div className="px-5 py-4 grid grid-cols-2 gap-2">
          <MetricTile label="Whale Score" value={w.whale_score ? `${w.whale_score}/100` : '—'} big />
          <MetricTile label="Portfolio" value={fmtUsd(w.portfolio_value_usd)} big />
          <MetricTile label="PnL 30d" value={fmtUsd(w.pnl_30d_usd)} tone={Number(w.pnl_30d_usd || 0) >= 0 ? 'green' : 'red'} />
          <MetricTile label="Win Rate" value={w.win_rate ? `${Math.round(Number(w.win_rate))}%` : '—'} />
          <MetricTile label="Trades 30d" value={w.trade_count_30d ? w.trade_count_30d.toLocaleString() : '—'} />
          <MetricTile label="Followers" value={(detail?.followerCount ?? w.follower_count ?? 0).toLocaleString()} />
          <MetricTile label="Last active" value={timeAgo(w.last_active_at)} />
          <MetricTile label="First seen" value={w.first_seen_at ? timeAgo(w.first_seen_at).replace('ago', 'old') : '—'} />
        </div>

        {/* Social / Arkham links */}
        {(w.x_handle || ark?.twitter || w.website || ark?.website) && (
          <div className="px-5 pb-4 flex items-center gap-2">
            {(w.x_handle || ark?.twitter) && (
              <a
                href={`https://x.com/${(w.x_handle || ark?.twitter || '').replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs"
              >
                <Twitter className="w-3.5 h-3.5" /> @{(w.x_handle || ark?.twitter)?.replace(/^@/, '')}
              </a>
            )}
            {(w.website || ark?.website) && (
              <a
                href={w.website || ark?.website || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs"
              >
                <Globe className="w-3.5 h-3.5" /> Website
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={onFollow}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] font-semibold text-sm hover:opacity-95"
          >
            Follow / Copy Trade
          </button>
        </div>

        {/* Activity feed */}
        <div className="px-5 py-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold">Recent Activity</h3>
            {detail?.source === 'live' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">LIVE · Alchemy</span>
            )}
            {detail?.source === 'db' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Indexed</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading activity…
            </div>
          ) : err ? (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">{err}</div>
          ) : activity.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">
              No recent activity — the address may be cold storage, or your Alchemy key hasn't indexed this chain.
            </div>
          ) : (
            <div className="space-y-2">
              {activity.slice(0, 25).map((a, i) => (
                <ActivityItem key={`${a.tx_hash}-${i}`} row={a} chain={w.chain} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function MetricTile({
  label,
  value,
  big = false,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  big?: boolean;
  tone?: 'green' | 'red' | 'neutral';
}) {
  const color = tone === 'green' ? 'text-emerald-400' : tone === 'red' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-mono font-bold mt-1 ${big ? 'text-lg' : 'text-sm'} ${color}`}>{value}</div>
    </div>
  );
}

function ActivityItem({ row, chain }: { row: ActivityRow; chain: string }) {
  const isOut = row.direction === 'out';
  const isIn = row.direction === 'in';
  const tone = isOut ? 'text-red-400' : isIn ? 'text-emerald-400' : 'text-slate-400';
  const Arrow = isOut ? TrendingDown : TrendingUp;

  return (
    <a
      href={txUrl(chain, row.tx_hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-colors"
    >
      <div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center ${tone}`}>
        <Arrow className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-bold ${tone}`}>{row.direction}</span>
          {row.token_symbol && <span className="text-xs font-mono text-white">{row.token_symbol}</span>}
          {row.value !== null && <span className="text-[11px] font-mono text-slate-400">{row.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>}
        </div>
        <div className="text-[10px] font-mono text-slate-500 truncate">
          {row.direction === 'out' && row.to_address ? `→ ${short(row.to_address)}` : ''}
          {row.direction === 'in' && row.from_address ? `← ${short(row.from_address)}` : ''}
          {row.direction === 'unknown' && <span>{row.tx_hash.slice(0, 16)}…</span>}
        </div>
      </div>
      <div className="text-[10px] text-slate-500 shrink-0">
        {row.timestamp ? timeAgo(row.timestamp) : '—'}
      </div>
      <ExternalLink className="w-3 h-3 text-slate-600" />
    </a>
  );
}
