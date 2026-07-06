'use client';

import { CheckCircle2, ChevronRight, TrendingUp, TrendingDown, Users, Star, Copy as CopyIcon } from 'lucide-react';
import { ChainLogo } from '@/components/common/ChainLogo';

/**
 * Canonical whale/trader card — the single card used across the Whale Tracker
 * (directory, live-feed traders view, watchlist) so every surface shows the
 * SAME output. Active, non-custodial traders get the copy-trade icon; custodial
 * exchange/bridge wallets show holdings + an honest "not applicable" note.
 */

export interface TraderCardData {
  address: string;
  chain: string;
  label: string | null;
  entity_type: string | null;
  archetype: string | null;
  whale_score: number | null;
  portfolio_value_usd: string | number | null;
  pnl_30d_usd: string | number | null;
  win_rate: string | number | null;
  volume_7d_usd: string | number | null;
  active_days_7d: number | null;
  follower_count: number | null;
  verified: boolean | null;
}

// Custodial / non-copy-tradeable entity types: exchange omnibus + institutional
// (CEX cold wallets, market makers) + bridges. You can't mirror these — the
// owner was explicit: "NOT institutional address but normal whale traders".
const CUSTODIAL_ENTITIES = new Set(['exchange', 'cex', 'bridge', 'institutional']);

export function isCopyTradeable(t: Pick<TraderCardData, 'entity_type' | 'active_days_7d'>): boolean {
  const custodial = CUSTODIAL_ENTITIES.has((t.entity_type || '').toLowerCase());
  return !custodial && (t.active_days_7d ?? 0) >= 4;
}

function fmtUsd(v: string | number | null): string {
  if (v === null || v === undefined) return 'n/a';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n) || n === 0) return 'n/a';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function short(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

// Stable "Naka Whale #N" handle derived from the address — same wallet always
// maps to the same number, so an untracked whale reads as a consistent identity
// across the directory, profile and watchlist instead of a bare 0x… string.
function nakaWhaleNumber(addr: string): number {
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  return (h % 9000) + 1000;
}

function chainColor(c: string): { bg: string; fg: string } {
  switch (c) {
    case 'ethereum': return { bg: 'bg-[#627EEA]/10', fg: 'text-[#627EEA]' };
    case 'solana': return { bg: 'bg-[#9945FF]/10', fg: 'text-[#9945FF]' };
    case 'base': return { bg: 'bg-[#0052FF]/10', fg: 'text-[#0052FF]' };
    case 'arbitrum': return { bg: 'bg-[#28A0F0]/10', fg: 'text-[#28A0F0]' };
    case 'optimism': return { bg: 'bg-[#FF0420]/10', fg: 'text-[#FF0420]' };
    case 'bsc': return { bg: 'bg-[#F0B90B]/10', fg: 'text-[#F0B90B]' };
    case 'polygon': return { bg: 'bg-[#8247E5]/10', fg: 'text-[#8247E5]' };
    case 'avalanche': return { bg: 'bg-[#E84142]/10', fg: 'text-[#E84142]' };
    default: return { bg: 'bg-slate-800', fg: 'text-slate-400' };
  }
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return `hsl(${h % 360} 65% 55%)`;
}

function Metric({ label, value, Icon, tone = 'neutral' }: {
  label: string; value: string; Icon?: typeof TrendingUp; tone?: 'green' | 'red' | 'neutral';
}) {
  const color = tone === 'green' ? 'text-emerald-400' : tone === 'red' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-black/20 rounded-lg p-2">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-[11px] font-bold font-mono mt-0.5 flex items-center gap-1 ${color}`}>
        {Icon && <Icon className="w-3 h-3" />}{value}
      </div>
    </div>
  );
}

export default function TraderCard({ trader, watched, onOpen, onFollow, onToggleWatch, onCopy }: {
  trader: TraderCardData;
  watched: boolean;
  onOpen: () => void;
  onFollow: () => void;
  onToggleWatch: () => void;
  onCopy: () => void;
}) {
  const c = chainColor(trader.chain);
  const score = trader.whale_score ?? 0;
  const pnl = Number(trader.pnl_30d_usd || 0);
  const custodial = CUSTODIAL_ENTITIES.has((trader.entity_type || '').toLowerCase());
  const copyable = isCopyTradeable(trader);
  // Every whale reads as a real identity — named entities keep their label, and
  // untracked wallets get a stable "Naka Whale #N" handle + a branded Naka
  // avatar so the directory never shows a bare 0x… address.
  const named = !!(trader.label && trader.label.trim());
  const displayName = named ? trader.label! : `Naka Whale #${nakaWhaleNumber(trader.address)}`;
  const seed = named ? trader.label!.slice(0, 2).toUpperCase() : null;

  return (
    <div className="group nl-glass nl-glass--interactive rounded-xl p-5 cursor-pointer" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl flex items-center justify-center font-bold text-white shrink-0 overflow-hidden"
          style={{ width: 40, height: 40, background: named ? avatarColor(trader.label!) : 'linear-gradient(135deg,#0066FF 0%,#00C8FF 100%)', fontSize: named ? 18 : 20 }}>
          {named ? seed : <span aria-hidden style={{ filter: 'saturate(0) brightness(2)' }}>🐺</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-white text-sm truncate">{displayName}</span>
            {trader.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#0066FF] shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${c.bg} ${c.fg}`}>
              <ChainLogo chain={trader.chain} size={11} />{trader.chain.toUpperCase()}
            </span>
            {(trader.active_days_7d ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/12 text-emerald-300 border border-emerald-500/25">{trader.active_days_7d}/7d</span>
            )}
            {trader.archetype && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 truncate max-w-[120px]">{trader.archetype}</span>}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1.5 truncate">{short(trader.address)}</div>
        </div>
        <div className="flex items-start gap-1.5 shrink-0 ps-2">
          <button
            type="button"
            aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
            onClick={(e) => { e.stopPropagation(); onToggleWatch(); }}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-md border transition-colors ${
              watched ? 'bg-[#0066FF]/15 border-[#0066FF]/45 text-[#8FA3FF]'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-[#8FA3FF] hover:border-[#0066FF]/30'
            }`}
          >
            <Star className="w-3.5 h-3.5" fill={watched ? 'currentColor' : 'none'} />
          </button>
          <div className="text-end">
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Score</div>
            <div className={`text-lg font-black font-mono leading-tight ${score >= 90 ? 'text-emerald-400' : score >= 75 ? 'text-[#8FA3FF]' : 'text-slate-400'}`}>{score}</div>
          </div>
        </div>
      </div>

      {custodial ? (
        <div className="mt-4">
          <Metric label="Holdings" value={fmtUsd(trader.portfolio_value_usd)} />
          <p className="text-[9px] text-slate-500 mt-1.5">Custodial wallet · PnL and win rate not applicable</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Metric label="Vol 7d" value={fmtUsd(trader.volume_7d_usd)} tone={trader.volume_7d_usd ? 'green' : 'neutral'} />
          <Metric label="PnL 30d" value={fmtUsd(trader.pnl_30d_usd)} Icon={pnl !== 0 ? (pnl >= 0 ? TrendingUp : TrendingDown) : undefined} tone={pnl > 0 ? 'green' : pnl < 0 ? 'red' : 'neutral'} />
          <Metric label="Win rate" value={trader.win_rate ? `${Math.round(Number(trader.win_rate))}%` : 'n/a'} />
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
        <div className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-slate-400 min-w-0">
          <Users className="w-3 h-3 shrink-0" />
          <span className="truncate tabular-nums">{(trader.follower_count || 0).toLocaleString()}</span>
        </div>
        <div className="ms-auto flex items-center gap-1.5 shrink-0">
          {copyable && (
            // Primary CTA — brighter fill + ring + label so copy-trade is the
            // most prominent action on the card (per the owner: "more visible").
            <button
              type="button"
              aria-label="Copy trade this whale"
              title="Copy trade"
              onClick={(e) => { e.stopPropagation(); onCopy(); }}
              className="inline-flex items-center justify-center gap-1 h-7 px-3 rounded-md nl-glass border border-[#0066FF]/45 text-[#8FA3FF] hover:text-white hover:border-[#0066FF]/70 text-[11px] font-bold transition-colors"
            >
              <CopyIcon className="w-3.5 h-3.5" /> Copy
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onFollow(); }}
            className="inline-flex items-center justify-center h-7 px-3 rounded-md bg-[#0066FF]/15 hover:bg-[#0066FF]/25 border border-[#0066FF]/35 text-[#8FA3FF] text-[11px] font-semibold transition-colors"
          >
            Follow
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="inline-flex items-center justify-center gap-0.5 h-7 px-2.5 rounded-md nl-glass border border-[#0066FF]/30 text-[11px] text-[#8FA3FF] hover:text-white hover:border-[#0066FF]/60 transition-colors"
          >
            View <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
