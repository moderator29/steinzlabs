'use client';

import {
  Bell, Compass, Eye, Flame, Network, Shield, TrendingUp, Zap, Award, Lock,
  type LucideIcon,
} from 'lucide-react';
import type { Achievement, AchievementTier } from '@/lib/profile/achievements';

/**
 * AchievementBadge — renders one achievement tile, locked or unlocked.
 * Tier drives the border/glow color; the icon string from the catalog
 * is resolved against a small whitelist so we don't dynamic-import all
 * 800+ Lucide icons.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  Bell,
  Compass,
  Eye,
  Flame,
  Network,
  Shield,
  TrendingUp,
  Zap,
  Award,
};

const TIER_STYLE: Record<AchievementTier, { border: string; glow: string; ring: string }> = {
  bronze:   { border: '#B45309', glow: '0 0 12px rgba(180,83,9,0.35)',    ring: 'rgba(180,83,9,0.55)' },
  silver:   { border: '#94A3B8', glow: '0 0 14px rgba(148,163,184,0.35)', ring: 'rgba(148,163,184,0.55)' },
  gold:     { border: '#FACC15', glow: '0 0 18px rgba(250,204,21,0.55)',  ring: 'rgba(250,204,21,0.7)' },
  legendary:{ border: '#7C3AED', glow: '0 0 26px rgba(124,58,237,0.75)',  ring: 'rgba(124,58,237,0.85)' },
};

export interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt?: number; // unix seconds
}

export function AchievementBadge({ achievement, unlocked, unlockedAt }: AchievementBadgeProps) {
  const tier = TIER_STYLE[achievement.tier];
  const Icon = ICON_MAP[achievement.icon] ?? Award;
  const date = unlockedAt
    ? new Date(unlockedAt * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  return (
    <div
      className={`relative rounded-2xl border bg-white/[0.02] p-4 transition-all ${
        unlocked ? '' : 'opacity-50 grayscale'
      }`}
      style={{
        borderColor: unlocked ? tier.border : 'rgba(255,255,255,0.08)',
        boxShadow: unlocked ? tier.glow : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: unlocked
              ? `linear-gradient(135deg, ${tier.border}33, ${tier.border}11)`
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${unlocked ? tier.ring : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          {unlocked ? (
            <Icon className="w-5 h-5" style={{ color: tier.border }} />
          ) : (
            <Lock className="w-4 h-4 text-slate-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-bold ${unlocked ? 'text-white' : 'text-slate-400'}`}>
              {achievement.title}
            </h3>
            <span
              className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${tier.border}22`, color: tier.border }}
            >
              {achievement.tier}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
            {achievement.description}
          </p>
          {date ? (
            <p className="text-[10px] text-slate-500 mt-2 tabular-nums">Unlocked {date}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
