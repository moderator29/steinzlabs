'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Zap, Dna, Clock, Users, Activity } from 'lucide-react';
import { ChainLogo } from '@/components/common/ChainLogo';
import {
  type DetectedToken, fmtCompact, fmtInt, shortAddr,
  TokenAvatar, GuardianBadges, useTokenAudit,
  PlatformBadge, SocialLinks, BondingCurveBar,
} from '@/app/dashboard/sniper/sniperShared';

/** Per-status accent applied over the glass card (left edge + lit ring). */
function statusAccent(status: DetectedToken['status']): { ring: string; pill: string; label: string } {
  switch (status) {
    case 'safe':
      return { ring: 'rgba(16,185,129,.4), 0 0 16px rgba(16,185,129,.16)', pill: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30', label: 'safe' };
    case 'risky':
      return { ring: 'rgba(245,158,11,.4), 0 0 16px rgba(245,158,11,.16)', pill: 'text-amber-300 bg-amber-500/15 border-amber-500/30', label: 'risky' };
    case 'blocked':
      return { ring: 'rgba(239,68,68,.45), 0 0 16px rgba(239,68,68,.18)', pill: 'text-red-300 bg-red-500/15 border-red-500/30', label: 'blocked' };
    case 'sniped':
      return { ring: 'rgba(124,58,237,.45), 0 0 16px rgba(124,58,237,.18)', pill: 'text-purple-300 bg-purple-500/15 border-purple-500/30', label: 'sniped' };
    default:
      // scanning → default blue stride
      return { ring: 'rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)', pill: 'text-blue-200 bg-[#0066FF]/15 border-[#0066FF]/30', label: 'scanning' };
  }
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/40 font-semibold">
        <Icon className="w-2.5 h-2.5" /> {label}
      </div>
      <div className="text-xs font-bold text-white/90 truncate">{value}</div>
    </div>
  );
}

/**
 * MEVX-grade token discovery card. Renders real feed data only (DetectedToken /
 * SniperToken): logo, symbol + name, copy-address, platform badge, social row,
 * MC / VOL / age / holders / TX stats, bonding-curve bar, Shadow Guardian audit
 * badges, a DNA deep-link, and the quick-buy / snipe action (blocked when the
 * Guardian audit fails). Status drives a colored stride over the glass body.
 */
export function TokenCard({
  t,
  onSnipe,
  onOpen,
}: {
  t: DetectedToken;
  onSnipe: (t: DetectedToken) => void;
  onOpen: (t: DetectedToken) => void;
}) {
  const router = useRouter();
  const { audit, loading: auditLoading } = useTokenAudit(t.chain, t.address);
  const [copied, setCopied] = useState(false);
  const snipeBlocked = (audit?.blocked ?? false) || t.status === 'blocked';
  const accent = statusAccent(t.status);

  const copyAddr = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(t.address)
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1400); })
      .catch(() => {});
  };

  const openDna = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/dashboard/contract-analyzer?address=${t.address}&chain=${t.chain}`);
  };

  return (
    <div
      onClick={() => onOpen(t)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t); }}
      className="nl-glass rounded-2xl p-3.5 flex flex-col gap-3 cursor-pointer hover:-translate-y-px transition"
      style={{ boxShadow: `0 0 0 1px ${accent.ring}` }}
    >
      {/* ── Header: logo, identity, copy, status ── */}
      <div className="flex items-start gap-3">
        <TokenAvatar logo={t.logo} symbol={t.symbol} address={t.address} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold truncate">{t.symbol}</span>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40 shrink-0">
              <ChainLogo chain={t.chain} size={11} />{t.chain}
            </span>
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border shrink-0 ${accent.pill}`}>
              {accent.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <span className="text-xs text-white/50 truncate">{t.name}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <button
              onClick={copyAddr}
              title="Copy contract address"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/10 text-[10px] text-white/55 hover:text-white transition"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-emerald-300" /> : <Copy className="w-2.5 h-2.5" />}
              {shortAddr(t.address)}
            </button>
            <PlatformBadge source={t.source} label={t.sourceLabel} icon={t.sourceIcon} url={t.url} />
            <SocialLinks socials={t.socials} />
          </div>
        </div>
      </div>

      {/* ── Stat grid ── */}
      <div className="grid grid-cols-4 gap-2">
        <Stat icon={Activity} label="MC" value={fmtCompact(t.marketCap ?? t.fdv)} />
        <Stat icon={Activity} label="Vol" value={fmtCompact(t.volume24h)} />
        <Stat icon={Clock} label="Age" value={t.pairAge ?? 'new'} />
        <Stat icon={Users} label="Holders" value={fmtInt(t.holders)} />
      </div>
      <div className="grid grid-cols-4 gap-2 -mt-1">
        <Stat icon={Activity} label="Liq" value={fmtCompact(t.liquidity)} />
        <Stat icon={Activity} label="TX 24h" value={fmtInt(t.txns24h)} />
        <Stat
          icon={Activity}
          label="Fee"
          value={t.tax != null ? `${t.tax}%` : '—'}
        />
        <Stat
          icon={Activity}
          label="24h"
          value={t.priceChange24h != null ? `${t.priceChange24h > 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}%` : '—'}
        />
      </div>

      {/* ── Bonding curve (when applicable) ── */}
      {t.bondingCurvePct != null && <BondingCurveBar pct={t.bondingCurvePct} />}

      {/* ── Guardian audit badges ── */}
      <GuardianBadges audit={audit} loading={auditLoading} />

      {/* ── Actions ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onSnipe(t); }}
          disabled={snipeBlocked}
          title={snipeBlocked ? 'Blocked by Shadow Guardian — failed security checks' : 'Quick buy / snipe this token'}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${
            snipeBlocked
              ? 'bg-red-500/10 border-red-500/30 text-red-300/70 cursor-not-allowed'
              : 'nl-btn-neon'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          {snipeBlocked ? 'Blocked' : 'Quick Buy'}
        </button>
        <button
          onClick={openDna}
          title="DNA — open in Contract Analyzer"
          className="nl-button nl-button--ghost shrink-0 px-3 py-2 rounded-xl text-xs font-bold"
        >
          <Dna className="w-3.5 h-3.5" /> DNA
        </button>
      </div>
    </div>
  );
}
