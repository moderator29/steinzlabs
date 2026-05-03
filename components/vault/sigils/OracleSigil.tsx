/**
 * Oracle sigil — visor / helmet form. Deep blue gradient with electric
 * highlights. Matches the brand reference's middle icon. Represents
 * sight: Daily Seal, VTX Sage, Whisper Network.
 */
export function OracleSigil({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={className}
      role="img"
      aria-label="The Oracle"
    >
      <defs>
        <linearGradient id="oracle-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B5BFF" />
          <stop offset="50%" stopColor="#1230B3" />
          <stop offset="100%" stopColor="#050B40" />
        </linearGradient>
        <linearGradient id="oracle-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00C8FF" />
          <stop offset="100%" stopColor="#0066FF" />
        </linearGradient>
        <radialGradient id="oracle-halo" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0%" stopColor="#1E90FF" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
        </radialGradient>
        <filter id="oracle-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="48" cy="48" r="40" fill="url(#oracle-halo)" />

      <g filter="url(#oracle-glow)">
        {/* Helmet outline */}
        <path
          d="M48 14 C 28 14, 18 32, 20 52 C 22 70, 34 80, 48 80 C 62 80, 74 70, 76 52 C 78 32, 68 14, 48 14 Z"
          fill="url(#oracle-body)"
          stroke="rgba(120,170,255,0.4)"
          strokeWidth="1"
        />
        {/* Visor sweep */}
        <path
          d="M28 38 C 30 32, 38 28, 48 28 C 58 28, 66 32, 68 38 L 66 56 C 60 60, 54 62, 48 62 C 42 62, 36 60, 30 56 Z"
          fill="url(#oracle-visor)"
          opacity="0.95"
        />
        {/* Visor highlight */}
        <path
          d="M30 38 C 34 34, 42 32, 48 32 C 54 32, 60 34, 64 38 L 62 44 C 56 42, 50 41, 48 41 C 46 41, 40 42, 34 44 Z"
          fill="#FFFFFF"
          opacity="0.18"
        />
        {/* Chin / collar */}
        <path
          d="M36 70 C 40 76, 44 78, 48 78 C 52 78, 56 76, 60 70 Z"
          fill="#0A1030"
          stroke="rgba(120,170,255,0.4)"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
