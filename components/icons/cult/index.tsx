/**
 * Cult Icon System — glowing geometric, gradient-filled, soft outer glow.
 *
 * Visual reference: the rocket / helmet / pentagon trio from the W
 * "REDEFINING THE WEB3 SPACE" image. Every icon in this library shares:
 *   - Gradient fill (signature: blue #0066FF → crimson #DC143C, with
 *     per-icon variants — rocket gets purple-pink, helmet stays pure blue,
 *     pentagon goes electric blue)
 *   - Soft outer glow halo via SVG filter (id: "cultGlow")
 *   - 24×24 viewBox by default to drop in anywhere lucide-react fits
 *   - Same prop API as lucide-react (size, color, className, ...rest) so
 *     swapping is mechanical: `import { Wallet } from 'lucide-react'`
 *     becomes `import { Wallet } from '@/components/icons/cult'`
 *
 * This file is the starter set covering the highest-frequency platform
 * icons (~24). The platform-wide ascension PR series adds the remaining
 * ~60 icons in the same style; new icons follow the same pattern below.
 */

import type { SVGProps } from 'react';

export interface CultIconProps extends Omit<SVGProps<SVGSVGElement>, 'fill'> {
  size?: number | string;
  variant?: 'blue' | 'crimson' | 'rocket' | 'pentagon' | 'gold';
}

// Shared gradient + glow defs. Inlined per-icon so each <svg> is fully
// portable (drag-and-drop into any DOM context, no global filter dep).
function CultDefs({ id, variant = 'blue' }: { id: string; variant: CultIconProps['variant'] }) {
  const stops = (() => {
    switch (variant) {
      case 'crimson':  return [['0%', '#FF3DCB'], ['100%', '#DC143C']];
      case 'rocket':   return [['0%', '#7B2BFF'], ['50%', '#FF3DCB'], ['100%', '#00A1FF']];
      case 'pentagon': return [['0%', '#00C8FF'], ['100%', '#0066FF']];
      case 'gold':     return [['0%', '#FFE89A'], ['100%', '#FFD86B']];
      case 'blue':
      default:         return [['0%', '#00C8FF'], ['100%', '#0066FF']];
    }
  })();
  return (
    <defs>
      <linearGradient id={`g-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
        {stops.map(([offset, color]) => (
          <stop key={offset} offset={offset} stopColor={color} />
        ))}
      </linearGradient>
      <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function makeIcon(name: string, defaultVariant: CultIconProps['variant'], path: (gid: string, glowId: string) => React.ReactNode) {
  const Icon = ({ size = 20, variant = defaultVariant, className = '', ...rest }: CultIconProps) => {
    const id = `${name}-${Math.random().toString(36).slice(2, 8)}`;
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
        {...rest}
      >
        <CultDefs id={id} variant={variant} />
        {path(`g-${id}`, `glow-${id}`)}
      </svg>
    );
  };
  Icon.displayName = `Cult${name}`;
  return Icon;
}

// ─── Navigation & dashboard ───────────────────────────────────────────────

export const Dashboard = makeIcon('Dashboard', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="3"  y="3"  width="8" height="8" rx="2" />
    <rect x="13" y="3"  width="8" height="5" rx="2" />
    <rect x="13" y="10" width="8" height="11" rx="2" />
    <rect x="3"  y="13" width="8" height="8" rx="2" />
  </g>
));

export const Search = makeIcon('Search', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" fill="none">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <line x1="20" y1="20" x2="15.5" y2="15.5" />
  </g>
));

export const Bell = makeIcon('Bell', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M12 2.5a6 6 0 0 0-6 6v3.2L4 15h16l-2-3.3V8.5a6 6 0 0 0-6-6z" />
    <path d="M9.5 18a2.5 2.5 0 0 0 5 0z" />
  </g>
));

export const User = makeIcon('User', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <circle cx="12" cy="8"  r="4.2" />
    <path d="M4 21a8 8 0 0 1 16 0z" />
  </g>
));

export const Settings = makeIcon('Settings', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.9-1.5-1.8-3.1-2.3.8a7.7 7.7 0 0 0-2.6-1.5L14 2.5h-4l-.6 2.7A7.7 7.7 0 0 0 6.8 6.7l-2.3-.8L2.7 9l1.9 1.5a7.7 7.7 0 0 0 0 3L2.7 15l1.8 3.1 2.3-.8a7.7 7.7 0 0 0 2.6 1.5l.6 2.7h4l.6-2.7a7.7 7.7 0 0 0 2.6-1.5l2.3.8 1.8-3.1z" />
    <circle cx="12" cy="12" r="3.2" fill="#050816" />
  </g>
));

export const Menu = makeIcon('Menu', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round">
    <line x1="4" y1="6"  x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </g>
));

export const X = makeIcon('X', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round">
    <line x1="6"  y1="6"  x2="18" y2="18" />
    <line x1="18" y1="6"  x2="6"  y2="18" />
  </g>
));

// ─── Money + trading ──────────────────────────────────────────────────────

export const Wallet = makeIcon('Wallet', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <circle cx="17" cy="12.5" r="1.6" fill="#050816" />
  </g>
));

export const Coin = makeIcon('Coin', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <circle cx="12" cy="12" r="9" fill={`url(#${gid})`} />
    <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#050816">$</text>
  </g>
));

export const TrendingUp = makeIcon('TrendingUp', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </g>
));

export const TrendingDown = makeIcon('TrendingDown', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <polyline points="3 7 9 13 13 9 21 17" />
    <polyline points="15 17 21 17 21 11" />
  </g>
));

export const ChartBar = makeIcon('ChartBar', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="3"  y="13" width="4" height="8" rx="1" />
    <rect x="10" y="8"  width="4" height="13" rx="1" />
    <rect x="17" y="4"  width="4" height="17" rx="1" />
  </g>
));

export const ChartCandle = makeIcon('ChartCandle', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`} stroke={`url(#${gid})`} strokeWidth="1.5">
    <line x1="6"  y1="3"  x2="6"  y2="21" />
    <rect x="4"  y="7"  width="4" height="9" />
    <line x1="14" y1="3" x2="14" y2="21" />
    <rect x="12" y="11" width="4" height="7" />
  </g>
));

// ─── Cult-specific ────────────────────────────────────────────────────────

export const Sigil = makeIcon('Sigil', 'rocket', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M12 2.5l9 5.5v7.5L12 21.5L3 15.5V8z" opacity="0.85" />
    <path d="M12 7l5 3.2v3.6L12 17l-5-3.2v-3.6z" fill="#050816" />
    <circle cx="12" cy="12" r="1.6" fill={`url(#${gid})`} />
  </g>
));

export const Vault = makeIcon('Vault', 'pentagon', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <rect x="3" y="4" width="18" height="16" rx="3" fill={`url(#${gid})`} opacity="0.25" stroke={`url(#${gid})`} strokeWidth="1.5" />
    <circle cx="12" cy="12" r="4" fill="none" stroke={`url(#${gid})`} strokeWidth="2" />
    <circle cx="12" cy="12" r="1.4" fill={`url(#${gid})`} />
    <line x1="12" y1="6" x2="12" y2="8" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
  </g>
));

export const Crown = makeIcon('Crown', 'gold', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M3 17l1.5-9L9 13l3-7l3 7l4.5-5L21 17z" />
    <rect x="3" y="18" width="18" height="3" rx="0.6" />
  </g>
));

export const Shield = makeIcon('Shield', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M12 2.5l8 3v6.5c0 4.6-3.5 8.6-8 9.5c-4.5-.9-8-4.9-8-9.5V5.5z" />
  </g>
));

// ─── Status / state ───────────────────────────────────────────────────────

export const CheckCircle = makeIcon('CheckCircle', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <circle cx="12" cy="12" r="9" fill={`url(#${gid})`} />
    <polyline points="8 12.5 11 15.5 16.5 9.5" fill="none" stroke="#050816" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </g>
));

export const XCircle = makeIcon('XCircle', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <circle cx="12" cy="12" r="9" fill={`url(#${gid})`} />
    <line x1="9"  y1="9"  x2="15" y2="15" stroke="#050816" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="15" y1="9"  x2="9"  y2="15" stroke="#050816" strokeWidth="2.2" strokeLinecap="round" />
  </g>
));

export const Loader = makeIcon('Loader', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" fill="none">
    <line x1="12" y1="2"  x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2"  y1="12" x2="6"  y2="12" opacity="0.5" />
    <line x1="18" y1="12" x2="22" y2="12" opacity="0.5" />
  </g>
));

// ─── Activity / data ──────────────────────────────────────────────────────

export const Eye = makeIcon('Eye', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <path d="M2 12s3.5-7 10-7s10 7 10 7s-3.5 7-10 7s-10-7-10-7z" fill={`url(#${gid})`} opacity="0.85" />
    <circle cx="12" cy="12" r="3" fill="#050816" />
    <circle cx="12" cy="12" r="1.4" fill={`url(#${gid})`} />
  </g>
));

export const Activity = makeIcon('Activity', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <polyline points="3 12 7 12 10 4 14 20 17 12 21 12" />
  </g>
));

export const Whale = makeIcon('Whale', 'pentagon', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M3 12c0-4 4-7 9-7s9 3 9 7c0 3-2.5 6-6 7l-2 3l-2-3c-4.5-.5-8-3.5-8-7z" />
    <circle cx="9" cy="11" r="0.9" fill="#050816" />
  </g>
));

export const Sparkle = makeIcon('Sparkle', 'rocket', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
    <circle cx="19" cy="5" r="1.2" />
    <circle cx="5"  cy="19" r="1" />
  </g>
));

// ─── Navigation extras (added in Phase A ascension) ──────────────────────

export const Home = makeIcon('Home', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M3 11.5L12 3l9 8.5V21h-6v-6h-6v6H3z" />
  </g>
));

export const MessageSquare = makeIcon('MessageSquare', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4z" />
  </g>
));

export const Bot = makeIcon('Bot', 'rocket', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="4" y="7" width="16" height="13" rx="3" />
    <line x1="12" y1="2" x2="12" y2="5" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
    <circle cx="9"  cy="13" r="1.4" fill="#050816" />
    <circle cx="15" cy="13" r="1.4" fill="#050816" />
  </g>
));

export const Zap = makeIcon('Zap', 'rocket', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M13 2L4 14h6l-2 8l9-12h-6z" />
  </g>
));

export const ArrowUpRight = makeIcon('ArrowUpRight', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <line x1="6" y1="18" x2="18" y2="6" />
    <polyline points="9 6 18 6 18 15" />
  </g>
));

export const ArrowDownRight = makeIcon('ArrowDownRight', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <line x1="6" y1="6" x2="18" y2="18" />
    <polyline points="9 18 18 18 18 9" />
  </g>
));

export const ArrowLeftRight = makeIcon('ArrowLeftRight', 'pentagon', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <polyline points="8 7 4 11 8 15" />
    <line x1="4"  y1="11" x2="20" y2="11" />
    <polyline points="16 17 20 13 16 9" opacity="0" />
    <polyline points="16 9 20 13 16 17" />
    <line x1="20" y1="13" x2="4"  y2="13" />
  </g>
));

export const PieChart = makeIcon('PieChart', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <path d="M12 3v9h9a9 9 0 1 1-9-9z" fill={`url(#${gid})`} opacity="0.4" />
    <path d="M13 2.5a9 9 0 0 1 8.5 8.5H13z" fill={`url(#${gid})`} />
  </g>
));

export const DollarSign = makeIcon('DollarSign', 'gold', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" fill="none">
    <line x1="12" y1="2" x2="12" y2="22" />
    <path d="M17 6.5a4.5 4.5 0 0 0-4.5-2c-2.5 0-4.5 1.5-4.5 4s2 3.5 5 4s5 1.5 5 4s-2 4-5 4a4.5 4.5 0 0 1-4.5-2.5" />
  </g>
));

export const Trophy = makeIcon('Trophy', 'gold', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M3 5h4v3a3 3 0 0 1-3 3v-1a2 2 0 0 0 2-2z" />
    <path d="M21 5h-4v3a3 3 0 0 0 3 3v-1a2 2 0 0 1-2-2z" />
    <rect x="9" y="14" width="6" height="3" />
    <rect x="6" y="17" width="12" height="3" rx="0.6" />
  </g>
));

export const Target = makeIcon('Target', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2" fill="none">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5.5" />
    <circle cx="12" cy="12" r="2"  fill={`url(#${gid})`} />
  </g>
));

export const Crosshair = makeIcon('Crosshair', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2" fill="none">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="2"  x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2"  y1="12" x2="6"  y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </g>
));

export const Network = makeIcon('Network', 'pentagon', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`} stroke={`url(#${gid})`} strokeWidth="1.5">
    <circle cx="12" cy="4"  r="2.4" />
    <circle cx="5"  cy="20" r="2.4" />
    <circle cx="19" cy="20" r="2.4" />
    <line x1="12" y1="6.4" x2="5"  y2="17.6" fill="none" />
    <line x1="12" y1="6.4" x2="19" y2="17.6" fill="none" />
    <line x1="5"  y1="20"  x2="19" y2="20"   fill="none" />
  </g>
));

export const Globe = makeIcon('Globe', 'pentagon', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="1.8" fill="none">
    <circle cx="12" cy="12" r="9" />
    <ellipse cx="12" cy="12" rx="4" ry="9" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </g>
));

export const Link2 = makeIcon('Link2', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" strokeLinecap="round" fill="none">
    <path d="M9 12h6" />
    <path d="M9 7H6.5a4.5 4.5 0 1 0 0 9H9" />
    <path d="M15 7h2.5a4.5 4.5 0 1 1 0 9H15" />
  </g>
));

export const Radio = makeIcon('Radio', 'pentagon', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="1.8" fill="none">
    <circle cx="12" cy="12" r="2" fill={`url(#${gid})`} />
    <path d="M8 8a5.7 5.7 0 0 0 0 8" />
    <path d="M16 8a5.7 5.7 0 0 1 0 8" />
    <path d="M5 5a9.9 9.9 0 0 0 0 14" />
    <path d="M19 5a9.9 9.9 0 0 1 0 14" />
  </g>
));

export const Dna = makeIcon('Dna', 'rocket', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="1.8" strokeLinecap="round" fill="none">
    <path d="M5 3c4 4 10 4 14 0" />
    <path d="M5 21c4-4 10-4 14 0" />
    <path d="M5 9c4 4 10 4 14 0" />
    <path d="M5 15c4-4 10-4 14 0" />
  </g>
));

export const FlaskConical = makeIcon('FlaskConical', 'rocket', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M9 2h6v5l5 11a2 2 0 0 1-1.8 2.9H5.8A2 2 0 0 1 4 18z" opacity="0.85" />
    <line x1="9" y1="2"  x2="15" y2="2"  stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
  </g>
));

export const FileCode = makeIcon('FileCode', 'pentagon', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M5 3h9l5 5v13H5z" opacity="0.85" />
    <polyline points="10 12 8 14 10 16" fill="none" stroke="#050816" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="14 12 16 14 14 16" fill="none" stroke="#050816" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </g>
));

export const FileSearch = makeIcon('FileSearch', 'pentagon', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M5 3h9l5 5v13H5z" opacity="0.85" />
    <circle cx="11.5" cy="14.5" r="2.5" fill="none" stroke="#050816" strokeWidth="1.6" />
    <line x1="13.5" y1="16.5" x2="15.5" y2="18.5" stroke="#050816" strokeWidth="1.6" strokeLinecap="round" />
  </g>
));

export const CheckSquare = makeIcon('CheckSquare', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <rect x="3" y="3" width="18" height="18" rx="3" fill={`url(#${gid})`} />
    <polyline points="7 12 11 16 17 9" fill="none" stroke="#050816" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </g>
));

export const BookOpen = makeIcon('BookOpen', 'gold', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M3 5a13 13 0 0 1 9 2v13a13 13 0 0 0-9-2z" />
    <path d="M21 5a13 13 0 0 0-9 2v13a13 13 0 0 1 9-2z" opacity="0.7" />
  </g>
));

export const Archive = makeIcon('Archive', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="3" y="3" width="18" height="5" rx="1.5" />
    <path d="M5 8h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" opacity="0.85" />
    <line x1="9" y1="13" x2="15" y2="13" stroke="#050816" strokeWidth="2" strokeLinecap="round" />
  </g>
));

export const History = makeIcon('History', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2" fill="none" strokeLinecap="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <polyline points="3 3 3 8 8 8" />
    <polyline points="12 7 12 12 16 14" />
  </g>
));

export const Circle = makeIcon('Circle', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <circle cx="12" cy="12" r="9" fill="none" stroke={`url(#${gid})`} strokeWidth="2.4" />
  </g>
));

// Re-export grouping for ergonomics. Consumers can do
//   import { Wallet, Sigil } from '@/components/icons/cult'
// or import the namespace:
//   import * as CultIcons from '@/components/icons/cult'
