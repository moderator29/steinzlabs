/**
 * VerifiedGoldBadge — X (Twitter) Premium-style gold verification mark.
 *
 * Renders a notched/scalloped gold-gradient star with a white check inside.
 * Used next to verified user display names across the platform.
 *
 * Reusable: pass `size` in pixels (default 16) and an optional tooltip via
 * `title`. The badge is purely decorative SVG — no external dependencies,
 * crisp at any size.
 */

interface VerifiedGoldBadgeProps {
  size?: number;
  title?: string;
  className?: string;
}

export function VerifiedGoldBadge({
  size = 16,
  title = "Verified",
  className,
}: VerifiedGoldBadgeProps) {
  // Unique gradient ID per render so multiple badges on a page don't collide.
  const gradId = `naka-verified-gold-${size}`;
  const ringId = `naka-verified-ring-${size}`;

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
        {/* Gold gradient — matches X Premium spec (#FFD93D top → #C8A23A bottom) */}
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE57F" />
          <stop offset="45%" stopColor="#FFC83D" />
          <stop offset="100%" stopColor="#C8902F" />
        </linearGradient>
        {/* Subtle inner-rim highlight */}
        <linearGradient id={ringId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF7C2" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#FFE082" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Scalloped/notched 16-point star body — same outline X uses for Premium.
          Built once at viewBox 22x22 for crisp rendering. */}
      <path
        fill={`url(#${gradId})`}
        d="M11 0.5 L13 2.2 L15.4 1.4 L16.6 3.6 L19.1 3.7 L19.3 6.2 L21.4 7.6 L20.5 9.9 L21.5 12.2 L19.7 13.9 L19.9 16.4 L17.5 17.0 L16.6 19.3 L14.1 19.0 L12.2 20.7 L10 19.6 L7.8 20.7 L5.9 19.0 L3.4 19.3 L2.5 17.0 L0.1 16.4 L0.3 13.9 L-1.5 12.2 L-0.5 9.9 L-1.4 7.6 L0.7 6.2 L0.9 3.7 L3.4 3.6 L4.6 1.4 L7.0 2.2 Z"
      />
      {/* Inner highlight rim — top-left lighter glint for depth */}
      <path
        fill={`url(#${ringId})`}
        opacity="0.9"
        d="M11 1.5 L12.6 2.8 L14.6 2.2 L15.6 4.0 L17.6 4.1 L17.8 6.1 L19.5 7.2 L18.8 9.1 L19.5 10.9 L18.0 12.2 L18.2 14.0 Q14 5 4 4.6 L4 4.0 L5.4 2.2 L7.4 2.8 Z"
      />
      {/* White checkmark — slightly thicker than lucide's default for legibility at 12-14px */}
      <path
        d="M6.6 11.2 L9.4 14.0 L15.4 7.8"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
