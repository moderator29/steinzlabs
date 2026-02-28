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
        <linearGradient id="steinz-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="steinz-inner" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="100%" stopColor="white" stopOpacity="0.85" />
        </linearGradient>
        <filter id="steinz-glow">
          <feGaussianBlur stdDeviation="2" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="64" height="64" rx="16" fill="url(#steinz-bg)" />

      <rect x="2" y="2" width="60" height="60" rx="14" fill="none" stroke="white" strokeOpacity="0.15" strokeWidth="1" />

      <g filter="url(#steinz-glow)">
        <path
          d="M 38 16 C 38 16 44 18 44 24 C 44 30 36 30 36 30 L 28 30 C 28 30 20 30 20 36 C 20 42 28 44 28 44"
          stroke="url(#steinz-inner)"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />

        <line x1="22" y1="18" x2="36" y2="18" stroke="url(#steinz-inner)" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="28" y1="46" x2="42" y2="46" stroke="url(#steinz-inner)" strokeWidth="4.5" strokeLinecap="round" />

        <circle cx="18" cy="18" r="3" fill="#00E5FF" opacity="0.6" />
        <circle cx="46" cy="46" r="3" fill="#7C3AED" opacity="0.6" />
      </g>
    </svg>
  );
}
