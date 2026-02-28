'use client';

export default function SteinzLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="steinz-bg-bw" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1A1A2E" />
          <stop offset="100%" stopColor="#0A0A14" />
        </linearGradient>
        <linearGradient id="steinz-s-bw" x1="18" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#E0E0E0" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
        <filter id="steinz-glow-bw">
          <feGaussianBlur stdDeviation="1.5" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="steinz-shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>

      <rect width="64" height="64" rx="14" fill="url(#steinz-bg-bw)" />

      <rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="1" />

      <rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="white" strokeOpacity="0.04" strokeWidth="0.5" />

      <g filter="url(#steinz-glow-bw)">
        <path
          d="M 38 16 C 38 16 44 18 44 24 C 44 30 36 30 36 30 L 28 30 C 28 30 20 30 20 36 C 20 42 28 44 28 44"
          stroke="url(#steinz-s-bw)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />

        <line x1="22" y1="18" x2="36" y2="18" stroke="url(#steinz-s-bw)" strokeWidth="4" strokeLinecap="round" />
        <line x1="28" y1="46" x2="42" y2="46" stroke="url(#steinz-s-bw)" strokeWidth="4" strokeLinecap="round" />

        <circle cx="18" cy="18" r="2" fill="white" opacity="0.4" />
        <circle cx="46" cy="46" r="2" fill="white" opacity="0.4" />
      </g>

      <line x1="10" y1="56" x2="54" y2="56" stroke="white" strokeOpacity="0.06" strokeWidth="0.5" />

      <rect x="48" y="8" width="1" height="1" fill="white" opacity="0.15" rx="0.5" />
      <rect x="52" y="12" width="0.8" height="0.8" fill="white" opacity="0.1" rx="0.4" />
    </svg>
  );
}
