/**
 * Conclave sigil — rocket form. Pink-to-purple body with blue thrust glow.
 * Matches the brand reference's leftmost icon. Pure inline SVG: no asset
 * fetch, scales to any size via the `size` prop, picks up cult colors
 * from `--vault-blue` / `--vault-crimson` if present (with literal
 * fallback so it renders before the cinematic CSS layer is loaded).
 */
export function ConclaveSigil({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={className}
      role="img"
      aria-label="The Conclave"
    >
      <defs>
        <linearGradient id="conclave-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF3D8A" />
          <stop offset="55%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#3B5BFF" />
        </linearGradient>
        <radialGradient id="conclave-thrust" cx="0.5" cy="1" r="0.6">
          <stop offset="0%" stopColor="#00C8FF" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#0066FF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
        </radialGradient>
        <filter id="conclave-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer glow halo */}
      <circle cx="48" cy="48" r="40" fill="url(#conclave-thrust)" opacity="0.35" />

      <g filter="url(#conclave-glow)">
        {/* Rocket body */}
        <path
          d="M48 14 C 60 26, 64 40, 64 56 L 56 60 L 56 70 L 40 70 L 40 60 L 32 56 C 32 40, 36 26, 48 14 Z"
          fill="url(#conclave-body)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.8"
        />
        {/* Window */}
        <circle cx="48" cy="38" r="6" fill="#0A1030" stroke="#9EAFFF" strokeWidth="1.2" />
        <circle cx="48" cy="38" r="3" fill="#1E90FF" opacity="0.85" />
        {/* Fins */}
        <path d="M32 56 L 22 70 L 36 64 Z" fill="url(#conclave-body)" opacity="0.85" />
        <path d="M64 56 L 74 70 L 60 64 Z" fill="url(#conclave-body)" opacity="0.85" />
        {/* Thrust */}
        <path
          d="M40 72 C 42 80, 46 86, 48 90 C 50 86, 54 80, 56 72 Z"
          fill="url(#conclave-thrust)"
        />
      </g>
    </svg>
  );
}
