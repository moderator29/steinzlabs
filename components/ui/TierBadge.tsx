/**
 * TierBadge — tier-aware verified-style mark shown next to a user's display
 * name across the platform.
 *
 *   Mini  → blue check        (X-style "blue verified")
 *   Pro   → platinum check    (silver gradient)
 *   Max   → gold scalloped    (X-Premium-grade "gold verified")
 *
 * Free users get nothing. Pure SVG, no external deps. The component picks
 * the right glyph for the tier so callers just pass `tier` — no need to
 * import three different badges.
 */

import type { Tier } from "@/lib/subscriptions/tierCheck";

interface TierBadgeProps {
  tier: Tier | string | null | undefined;
  size?: number;
  title?: string;
  className?: string;
}

export function TierBadge({ tier, size = 16, title, className }: TierBadgeProps) {
  const t = (tier ?? "free").toLowerCase();
  if (t === "max") return <GoldBadge size={size} title={title ?? "Max — Verified"} className={className} />;
  if (t === "pro") return <PlatinumBadge size={size} title={title ?? "Pro"} className={className} />;
  if (t === "mini") return <BlueBadge size={size} title={title ?? "Mini"} className={className} />;
  return null;
}

// ─── Mini: blue verified ──────────────────────────────────────────────────
export function BlueBadge({ size = 16, title = "Verified", className }: { size?: number; title?: string; className?: string }) {
  const id = `naka-tb-blue-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={title}
      role="img"
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5BB7FF" />
          <stop offset="60%" stopColor="#1D9BF0" />
          <stop offset="100%" stopColor="#0F76C0" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M11 0.5 L13 2.2 L15.4 1.4 L16.6 3.6 L19.1 3.7 L19.3 6.2 L21.4 7.6 L20.5 9.9 L21.5 12.2 L19.7 13.9 L19.9 16.4 L17.5 17.0 L16.6 19.3 L14.1 19.0 L12.2 20.7 L10 19.6 L7.8 20.7 L5.9 19.0 L3.4 19.3 L2.5 17.0 L0.1 16.4 L0.3 13.9 L-1.5 12.2 L-0.5 9.9 L-1.4 7.6 L0.7 6.2 L0.9 3.7 L3.4 3.6 L4.6 1.4 L7.0 2.2 Z"
      />
      <path d="M6.6 11.2 L9.4 14.0 L15.4 7.8" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── Pro: platinum/silver verified ────────────────────────────────────────
export function PlatinumBadge({ size = 16, title = "Verified", className }: { size?: number; title?: string; className?: string }) {
  const id = `naka-tb-plat-${size}`;
  const ring = `naka-tb-plat-ring-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={title}
      role="img"
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4F6F8" />
          <stop offset="40%" stopColor="#C9D1D9" />
          <stop offset="100%" stopColor="#7E8B9C" />
        </linearGradient>
        <linearGradient id={ring} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#E5EAF0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M11 0.5 L13 2.2 L15.4 1.4 L16.6 3.6 L19.1 3.7 L19.3 6.2 L21.4 7.6 L20.5 9.9 L21.5 12.2 L19.7 13.9 L19.9 16.4 L17.5 17.0 L16.6 19.3 L14.1 19.0 L12.2 20.7 L10 19.6 L7.8 20.7 L5.9 19.0 L3.4 19.3 L2.5 17.0 L0.1 16.4 L0.3 13.9 L-1.5 12.2 L-0.5 9.9 L-1.4 7.6 L0.7 6.2 L0.9 3.7 L3.4 3.6 L4.6 1.4 L7.0 2.2 Z"
      />
      <path
        fill={`url(#${ring})`}
        opacity="0.85"
        d="M11 1.5 L12.6 2.8 L14.6 2.2 L15.6 4.0 L17.6 4.1 L17.8 6.1 L19.5 7.2 L18.8 9.1 L19.5 10.9 L18.0 12.2 L18.2 14.0 Q14 5 4 4.6 L4 4.0 L5.4 2.2 L7.4 2.8 Z"
      />
      <path d="M6.6 11.2 L9.4 14.0 L15.4 7.8" stroke="#1A2230" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── Max: gold (re-export semantics from VerifiedGoldBadge with same path) ─
export function GoldBadge({ size = 16, title = "Verified", className }: { size?: number; title?: string; className?: string }) {
  const id = `naka-tb-gold-${size}`;
  const ring = `naka-tb-gold-ring-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={title}
      role="img"
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE57F" />
          <stop offset="45%" stopColor="#FFC83D" />
          <stop offset="100%" stopColor="#C8902F" />
        </linearGradient>
        <linearGradient id={ring} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF7C2" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#FFE082" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M11 0.5 L13 2.2 L15.4 1.4 L16.6 3.6 L19.1 3.7 L19.3 6.2 L21.4 7.6 L20.5 9.9 L21.5 12.2 L19.7 13.9 L19.9 16.4 L17.5 17.0 L16.6 19.3 L14.1 19.0 L12.2 20.7 L10 19.6 L7.8 20.7 L5.9 19.0 L3.4 19.3 L2.5 17.0 L0.1 16.4 L0.3 13.9 L-1.5 12.2 L-0.5 9.9 L-1.4 7.6 L0.7 6.2 L0.9 3.7 L3.4 3.6 L4.6 1.4 L7.0 2.2 Z"
      />
      <path
        fill={`url(#${ring})`}
        opacity="0.9"
        d="M11 1.5 L12.6 2.8 L14.6 2.2 L15.6 4.0 L17.6 4.1 L17.8 6.1 L19.5 7.2 L18.8 9.1 L19.5 10.9 L18.0 12.2 L18.2 14.0 Q14 5 4 4.6 L4 4.0 L5.4 2.2 L7.4 2.8 Z"
      />
      <path d="M6.6 11.2 L9.4 14.0 L15.4 7.8" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
