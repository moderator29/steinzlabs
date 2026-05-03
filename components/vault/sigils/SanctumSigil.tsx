/**
 * Sanctum sigil — pentagon / faceted gem form. Cool blues with violet
 * inner facets. Matches the brand reference's right icon. Represents
 * soul: identity, achievements, lore, music.
 */
export function SanctumSigil({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={className}
      role="img"
      aria-label="The Sanctum"
    >
      <defs>
        <linearGradient id="sanctum-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B5BFF" />
          <stop offset="100%" stopColor="#0A1030" />
        </linearGradient>
        <linearGradient id="sanctum-facet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9333EA" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#1E90FF" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="sanctum-halo" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0%" stopColor="#5B7BFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
        </radialGradient>
        <filter id="sanctum-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="48" cy="48" r="40" fill="url(#sanctum-halo)" />

      <g filter="url(#sanctum-glow)">
        {/* Outer pentagon */}
        <polygon
          points="48,14 82,38 70,78 26,78 14,38"
          fill="url(#sanctum-base)"
          stroke="rgba(120,170,255,0.45)"
          strokeWidth="1.2"
        />
        {/* Inner facet — top triangle */}
        <polygon
          points="48,14 82,38 48,48"
          fill="url(#sanctum-facet)"
          opacity="0.9"
        />
        {/* Inner facet — bottom-right */}
        <polygon
          points="48,48 82,38 70,78"
          fill="#1230B3"
          opacity="0.8"
        />
        {/* Inner facet — bottom-left */}
        <polygon
          points="48,48 70,78 26,78"
          fill="#0A1A66"
          opacity="0.85"
        />
        {/* Inner facet — left */}
        <polygon
          points="48,48 26,78 14,38"
          fill="#1230B3"
          opacity="0.7"
        />
        {/* Inner facet — top-left */}
        <polygon
          points="48,48 14,38 48,14"
          fill="url(#sanctum-facet)"
          opacity="0.75"
        />
        {/* Center highlight dot */}
        <circle cx="48" cy="48" r="2.5" fill="#FFFFFF" opacity="0.85" />
      </g>
    </svg>
  );
}
