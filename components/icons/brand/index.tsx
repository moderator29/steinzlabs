/**
 * Naka Labs Brand Icon System — glowing geometric, gradient-filled, soft outer glow.
 *
 * Visual reference: the rocket / helmet / pentagon trio from the W
 * "REDEFINING THE WEB3 SPACE" image. Every icon in this library shares:
 *   - Gradient fill (signature: blue #0066FF → crimson #DC143C, with
 *     per-icon variants — rocket gets purple-pink, helmet stays pure blue,
 *     pentagon goes electric blue)
 *   - Soft outer glow halo via SVG filter
 *   - 24×24 viewBox by default to drop in anywhere lucide-react fits
 *   - Same prop API as lucide-react (size, color, className, ...rest) so
 *     swapping is mechanical: `import { Wallet } from 'lucide-react'`
 *     becomes `import { Wallet } from '@/components/icons/brand'`
 *
 * This file is the starter set covering the highest-frequency platform
 * icons (~24). The platform-wide ascension PR series adds the remaining
 * ~60 icons in the same style; new icons follow the same pattern below.
 */

import type { SVGProps } from 'react';

export interface BrandIconProps extends Omit<SVGProps<SVGSVGElement>, 'fill'> {
  size?: number | string;
  variant?: 'blue' | 'crimson' | 'rocket' | 'pentagon' | 'gold';
}

// Shared gradient + glow defs. Inlined per-icon so each <svg> is fully
// portable (drag-and-drop into any DOM context, no global filter dep).
function BrandDefs({ id, variant = 'blue' }: { id: string; variant: BrandIconProps['variant'] }) {
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

function makeIcon(name: string, defaultVariant: BrandIconProps['variant'], path: (gid: string, glowId: string) => React.ReactNode) {
  const Icon = ({ size = 20, variant = defaultVariant, className = '', ...rest }: BrandIconProps) => {
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
        <BrandDefs id={id} variant={variant} />
        {path(`g-${id}`, `glow-${id}`)}
      </svg>
    );
  };
  Icon.displayName = `Brand${name}`;
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

// ─── Navigation chevrons + arrows ─────────────────────────────────────────

export const ChevronRight = makeIcon('ChevronRight', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <polyline points="9 5 16 12 9 19" />
  </g>
));

export const ChevronLeft = makeIcon('ChevronLeft', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <polyline points="15 5 8 12 15 19" />
  </g>
));

export const ChevronUp = makeIcon('ChevronUp', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <polyline points="5 15 12 8 19 15" />
  </g>
));

export const ChevronDown = makeIcon('ChevronDown', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <polyline points="5 9 12 16 19 9" />
  </g>
));

export const ArrowUp = makeIcon('ArrowUp', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <line x1="12" y1="20" x2="12" y2="4" />
    <polyline points="5 11 12 4 19 11" />
  </g>
));

export const ArrowDown = makeIcon('ArrowDown', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <line x1="12" y1="4" x2="12" y2="20" />
    <polyline points="5 13 12 20 19 13" />
  </g>
));

// ─── Action buttons (CRUD + standard ops) ─────────────────────────────────

export const Plus = makeIcon('Plus', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round">
    <line x1="12" y1="5"  x2="12" y2="19" />
    <line x1="5"  y1="12" x2="19" y2="12" />
  </g>
));

export const Minus = makeIcon('Minus', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </g>
));

export const Edit = makeIcon('Edit', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M14.5 4.5l5 5L9 20H4v-5z" />
    <rect x="15" y="3" width="6" height="3" rx="1.2" transform="rotate(45 18 4.5)" />
  </g>
));

export const Trash2 = makeIcon('Trash2', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="5" y="7" width="14" height="14" rx="2" />
    <line x1="3" y1="6" x2="21" y2="6" stroke={`url(#${gid})`} strokeWidth="2.2" strokeLinecap="round" />
    <rect x="9" y="3" width="6" height="3" rx="1" />
    <line x1="10" y1="11" x2="10" y2="17" stroke="#050816" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="14" y1="11" x2="14" y2="17" stroke="#050816" strokeWidth="1.8" strokeLinecap="round" />
  </g>
));

export const Save = makeIcon('Save', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M5 3h11l4 4v14H5z" />
    <rect x="8" y="3"  width="8" height="5" rx="0.6" fill="#050816" />
    <rect x="8" y="13" width="8" height="6" rx="0.6" fill="#050816" />
  </g>
));

export const Copy = makeIcon('Copy', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2" fill="none" strokeLinejoin="round">
    <rect x="8" y="8" width="12" height="12" rx="2" fill={`url(#${gid})`} fillOpacity="0.18" />
    <path d="M4 16V4h12" strokeLinecap="round" />
  </g>
));

export const ExternalLink = makeIcon('ExternalLink', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6" />
    <line x1="20" y1="4" x2="11" y2="13" />
    <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
  </g>
));

export const Share = makeIcon('Share', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <circle cx="6"  cy="12" r="3.2" />
    <circle cx="18" cy="5"  r="3.2" />
    <circle cx="18" cy="19" r="3.2" />
    <line x1="9"  y1="10.5" x2="15" y2="6.5"  stroke={`url(#${gid})`} strokeWidth="2" />
    <line x1="9"  y1="13.5" x2="15" y2="17.5" stroke={`url(#${gid})`} strokeWidth="2" />
  </g>
));

export const Download = makeIcon('Download', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="15" />
    <polyline points="6 11 12 17 18 11" />
    <line x1="4" y1="20" x2="20" y2="20" />
  </g>
));

export const Upload = makeIcon('Upload', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="5" />
    <polyline points="6 9 12 3 18 9" />
    <line x1="4" y1="20" x2="20" y2="20" />
  </g>
));

export const Send = makeIcon('Send', 'rocket', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <polygon points="3 3 21 12 3 21 6 12" />
  </g>
));

export const RefreshCw = makeIcon('RefreshCw', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 16-5.7" />
    <polyline points="19 3 19 7 15 7" />
    <path d="M21 12a9 9 0 0 1-16 5.7" />
    <polyline points="5 21 5 17 9 17" />
  </g>
));

export const Filter = makeIcon('Filter', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <polygon points="3 4 21 4 14 13 14 20 10 18 10 13" />
  </g>
));

export const MoreHorizontal = makeIcon('MoreHorizontal', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <circle cx="6"  cy="12" r="2.2" />
    <circle cx="12" cy="12" r="2.2" />
    <circle cx="18" cy="12" r="2.2" />
  </g>
));

export const MoreVertical = makeIcon('MoreVertical', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <circle cx="12" cy="6"  r="2.2" />
    <circle cx="12" cy="12" r="2.2" />
    <circle cx="12" cy="18" r="2.2" />
  </g>
));

// ─── Feedback / state ─────────────────────────────────────────────────────

export const Info = makeIcon('Info', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <circle cx="12" cy="12" r="9" fill={`url(#${gid})`} />
    <circle cx="12" cy="7.5" r="1.4" fill="#050816" />
    <rect x="11"  y="10" width="2" height="7" rx="0.6" fill="#050816" />
  </g>
));

export const AlertCircle = makeIcon('AlertCircle', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <circle cx="12" cy="12" r="9" fill={`url(#${gid})`} />
    <rect x="11"  y="6" width="2" height="8" rx="0.6" fill="#050816" />
    <circle cx="12" cy="17" r="1.4" fill="#050816" />
  </g>
));

export const AlertTriangle = makeIcon('AlertTriangle', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <polygon points="12 2 22 21 2 21" fill={`url(#${gid})`} />
    <rect x="11"  y="9" width="2" height="6" rx="0.6" fill="#050816" />
    <circle cx="12" cy="18" r="1.2" fill="#050816" />
  </g>
));

export const HelpCircle = makeIcon('HelpCircle', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <circle cx="12" cy="12" r="9" fill={`url(#${gid})`} />
    <path d="M9 9.5a3 3 0 1 1 4 2.8c-.7.4-1 .9-1 1.7" fill="none" stroke="#050816" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="17.2" r="1.2" fill="#050816" />
  </g>
));

export const Star = makeIcon('Star', 'gold', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <polygon points="12 2 14.6 8.6 22 9.3 16.5 14.2 18.2 21.5 12 17.8 5.8 21.5 7.5 14.2 2 9.3 9.4 8.6" />
  </g>
));

export const Heart = makeIcon('Heart', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M12 21s-7-4.5-9.3-9C1 8.6 3.4 5 7 5c2 0 3.7 1 5 3 1.3-2 3-3 5-3 3.6 0 6 3.6 4.3 7-2.3 4.5-9.3 9-9.3 9z" />
  </g>
));

export const ThumbsUp = makeIcon('ThumbsUp', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M2 11h4v10H2zM6 11l5-9c2 0 3 1.5 2.5 3.5L13 9h6c1.5 0 2.5 1 2.2 2.4l-1.6 7C19.4 19.6 18.4 20.5 17 20.5H6z" />
  </g>
));

export const ThumbsDown = makeIcon('ThumbsDown', 'crimson', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M2 3h4v10H2zM6 13l5 9c2 0 3-1.5 2.5-3.5L13 15h6c1.5 0 2.5-1 2.2-2.4l-1.6-7C19.4 4.4 18.4 3.5 17 3.5H6z" />
  </g>
));

// ─── Auth / privacy ──────────────────────────────────────────────────────

export const Lock = makeIcon('Lock', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1.4" fill="#050816" />
  </g>
));

export const Unlock = makeIcon('Unlock', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 7.5-2" fill="none" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1.4" fill="#050816" />
  </g>
));

export const EyeOff = makeIcon('EyeOff', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <path d="M2 12s3.5-7 10-7c2.4 0 4.4 1 6 2.3" fill="none" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
    <path d="M22 12s-3.5 7-10 7c-2.4 0-4.4-1-6-2.3" fill="none" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
    <line x1="3" y1="3" x2="21" y2="21" stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" />
  </g>
));

export const LogIn = makeIcon('LogIn', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" />
    <line x1="3" y1="12" x2="15" y2="12" />
    <polyline points="10 7 15 12 10 17" />
  </g>
));

export const LogOut = makeIcon('LogOut', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h4" />
    <line x1="21" y1="12" x2="9" y2="12" />
    <polyline points="16 7 21 12 16 17" />
  </g>
));

// ─── Date / time / theme ──────────────────────────────────────────────────

export const Calendar = makeIcon('Calendar', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="3" y="6" width="18" height="15" rx="2" />
    <rect x="3" y="6" width="18" height="4" fill="#050816" opacity="0.6" />
    <line x1="8"  y1="3" x2="8"  y2="9" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="3" x2="16" y2="9" stroke={`url(#${gid})`} strokeWidth="2" strokeLinecap="round" />
  </g>
));

export const Clock = makeIcon('Clock', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`}>
    <circle cx="12" cy="12" r="9" fill={`url(#${gid})`} />
    <polyline points="12 7 12 12 16 14" fill="none" stroke="#050816" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </g>
));

export const Sun = makeIcon('Sun', 'gold', (gid, glowId) => (
  <g filter={`url(#${glowId})`} stroke={`url(#${gid})`} strokeWidth="2.2" strokeLinecap="round" fill={`url(#${gid})`}>
    <circle cx="12" cy="12" r="4.5" />
    <line x1="12" y1="2"  x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2"  y1="12" x2="5"  y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="5"  y1="5"  x2="7"  y2="7" />
    <line x1="17" y1="17" x2="19" y2="19" />
    <line x1="5"  y1="19" x2="7"  y2="17" />
    <line x1="17" y1="7"  x2="19" y2="5" />
  </g>
));

export const Moon = makeIcon('Moon', 'pentagon', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M21 14a9 9 0 1 1-11-11 7 7 0 0 0 11 11z" />
  </g>
));

// ─── Media controls ──────────────────────────────────────────────────────

export const Play = makeIcon('Play', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <polygon points="6 4 20 12 6 20" />
  </g>
));

export const Pause = makeIcon('Pause', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="6"  y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </g>
));

// ─── Comms ────────────────────────────────────────────────────────────────

export const Mail = makeIcon('Mail', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <polyline points="3 6 12 13 21 6" fill="none" stroke="#050816" strokeWidth="1.8" strokeLinejoin="round" />
  </g>
));

// ─── Brands (kept neutral; consume per platform context) ──────────────────

export const Github = makeIcon('Github', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.5v-1.7c-2.78.62-3.37-1.36-3.37-1.36-.45-1.18-1.1-1.5-1.1-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.36 1.12 2.94.86.1-.67.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.74-.1-.26-.45-1.3.1-2.71 0 0 .85-.28 2.78 1.05.81-.23 1.68-.34 2.55-.34s1.74.11 2.55.34c1.93-1.33 2.78-1.05 2.78-1.05.55 1.41.2 2.45.1 2.71.64.71 1.03 1.62 1.03 2.74 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .28.18.6.69.5C19.14 20.58 22 16.76 22 12.26 22 6.58 17.52 2 12 2z" />
  </g>
));

export const Twitter = makeIcon('Twitter', 'blue', (gid, glowId) => (
  <g filter={`url(#${glowId})`} fill={`url(#${gid})`}>
    <path d="M22 5.8c-.7.3-1.5.5-2.3.6.8-.5 1.5-1.3 1.8-2.2-.8.5-1.7.8-2.6 1A4.1 4.1 0 0 0 12 9.1c0 .3 0 .6.1.9-3.4-.2-6.5-1.8-8.5-4.3-.4.6-.6 1.3-.6 2 0 1.4.7 2.7 1.8 3.4-.7 0-1.3-.2-1.8-.5v.1c0 2 1.4 3.7 3.3 4-.4.1-.7.1-1.1.1-.3 0-.5 0-.8-.1.5 1.7 2 2.9 3.8 2.9-1.4 1.1-3.2 1.7-5.1 1.7H2c1.8 1.2 4 1.9 6.3 1.9 7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.1z" />
  </g>
));

// Re-export grouping for ergonomics. Consumers can do
//   import { Wallet, Sigil } from '@/components/icons/brand'
// or import the namespace:
//   import * as BrandIcons from '@/components/icons/brand'
