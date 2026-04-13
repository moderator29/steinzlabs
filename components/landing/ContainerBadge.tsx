'use client';

import { Zap } from 'lucide-react';

export type BadgeType = 'AI_POWERED' | 'LIVE' | 'NEW' | 'BETA';
type BadgePosition = 'top-right' | 'top-left';

interface ContainerBadgeProps {
  type: BadgeType;
  position?: BadgePosition;
}

const BADGE_CONFIG: Record<BadgeType, {
  bg: string; border: string; shadow: string; text: string; pulse?: boolean;
}> = {
  AI_POWERED: {
    bg: 'linear-gradient(135deg,#0d1f88,#1a3acc)',
    border: '1px solid rgba(77,128,255,.6)',
    shadow: '0 0 14px rgba(26,58,204,.55)',
    text: 'AI POWERED',
  },
  LIVE: {
    bg: 'linear-gradient(135deg,#064e3b,#059669)',
    border: '1px solid rgba(16,185,129,.5)',
    shadow: '0 0 12px rgba(16,185,129,.45)',
    text: 'LIVE',
    pulse: true,
  },
  NEW: {
    bg: 'linear-gradient(135deg,#4c1d95,#7c3aed)',
    border: '1px solid rgba(139,92,246,.5)',
    shadow: '0 0 12px rgba(139,92,246,.45)',
    text: 'NEW',
  },
  BETA: {
    bg: 'linear-gradient(135deg,#78350f,#d97706)',
    border: '1px solid rgba(245,158,11,.5)',
    shadow: '0 0 12px rgba(245,158,11,.4)',
    text: 'BETA',
  },
};

export function ContainerBadge({ type, position = 'top-right' }: ContainerBadgeProps) {
  const cfg = BADGE_CONFIG[type];
  const pos: React.CSSProperties = position === 'top-right'
    ? { top: -9, right: -9 }
    : { top: -9, left: -9 };

  return (
    <div style={{
      position: 'absolute',
      ...pos,
      zIndex: 10,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      height: 22,
      padding: '0 8px',
      borderRadius: 11,
      background: cfg.bg,
      border: cfg.border,
      boxShadow: cfg.shadow,
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: 'white',
      whiteSpace: 'nowrap',
    }}>
      {cfg.pulse && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#10b981',
          animation: 'ping-dot 1.2s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      {type === 'AI_POWERED' && <Zap style={{ width: 9, height: 9 }} />}
      {cfg.text}

      <style>{`
        @keyframes ping-dot {
          0%,100%{opacity:1;transform:scale(1)}
          50%{opacity:.6;transform:scale(1.4)}
        }
        @keyframes badge-glow {
          0%,100%{box-shadow:${cfg.shadow}}
          50%{box-shadow:${cfg.shadow.replace(/[\d.]+\)$/, '0.85)')}}
        }
      `}</style>
    </div>
  );
}
