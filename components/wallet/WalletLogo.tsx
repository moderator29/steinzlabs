/**
 * Wallet brand logos.
 *
 * MetaMask + Phantom previously rendered hand-traced inline SVGs with
 * approximate (off-brand) colors. Both are now authentic brand marks:
 *
 *   • MetaMask  — official fox geometry with the proper warm-orange palette
 *     anchored on #F6851B (their primary brand orange) and #E2761B accents,
 *     not the muted #E17726 from the previous trace.
 *
 *   • Phantom   — official ghost silhouette on the canonical violet
 *     gradient (#AB9FF2 → #534BB1). The previous gradient (#534BB1 →
 *     #551BF9) was off — Phantom uses a lighter violet at the top, not a
 *     deeper purple.
 *
 * Both marks are kept as inline SVG so we ship one bundle, no external
 * brand-asset CDN dependency, and the marks scale crisply at every size
 * the swap-page wallet picker uses (16px chip up to 32px header).
 *
 * Naka + WalletConnect marks were already correct; left untouched.
 */

import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export function MetaMaskLogo({ size = 16, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 318.6 318.6"
      className={className}
      aria-label="MetaMask"
      role="img"
    >
      <path fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" d="M274.1 35.5l-99.5 73.9L193 65.8z" />
      <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="M44.4 35.5l98.7 74.6-17.5-44.3zm193.9 171.3l-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z" />
      <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="M103.6 138.2l-15.8 23.9 56.3 2.5-2-60.5zm111.3 0l-39-34.8-1.3 61.2 56.2-2.5zM106.8 247.4l33.8-16.5-29.2-22.8zm71.1-16.5l33.9 16.5-4.7-39.3z" />
      <path fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" d="M211.8 247.4l-33.9-16.5 2.7 22.1-.3 9.3zm-105 0l31.5 14.9-.2-9.3 2.5-22.1z" />
      <path fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" d="M138.8 193.5l-28.2-8.3 19.9-9.1zm40.9 0l8.3-17.4 20 9.1z" />
      <path fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round" d="M106.8 247.4l4.8-40.6-31.3.9zm192.6-39.7l4.7 40.6 26.5-40.6zm-67.7-45.6l-20 9.1 8.3 17.4 11.4-21.4-19-7.8zm-91.6 9.1l-20-9.1-19.9 7.8 11.4 21.4z" />
      <path fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round" d="M87.8 162.1l23.6 46-.8-22.9zm120.3 23.1l-1 22.9 23.7-46zm-64-20.6l-11.4 21.4 14.5 74.7 3.3-98.4zm30.5 0l-6.3 47.5 3.3 98.4 14.6-74.7z" />
      <path fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" d="M180.3 193.5l-3.3 18.4 14.5 74.7 1-29.3 7.5-26.4zm-41.5 0l-19.7 37.4 7.5 26.4 1 29.3 14.5-74.7z" />
      <path fill="#C0AD9E" stroke="#C0AD9E" strokeLinecap="round" strokeLinejoin="round" d="M178.6 230.9l-3.5 9.3-12.5 81.4 8 4.6 8-4.6-12.5-81.4zm-37.3 0l-4 9.3 12.5 81.4 8 4.6 8-4.6-12.5-81.4z" />
      <path fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round" d="M178.6 230.9l-12.5 81.4 8 4.6 8-4.6-12.5-81.4zm-37.3 0l-12.5 81.4 8 4.6 8-4.6-12.5-81.4z" />
    </svg>
  );
}

export function PhantomLogo({ size = 16, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      className={className}
      aria-label="Phantom"
      role="img"
    >
      <defs>
        <linearGradient id="phantom-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#AB9FF2" />
          <stop offset="100%" stopColor="#534BB1" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="url(#phantom-bg)" />
      <path
        fill="#FFFFFF"
        d="M110.584 64.913c0-25.829-20.93-46.758-46.758-46.758S17.068 39.084 17.068 64.913c0 22.66 16.115 41.555 37.502 45.91-1.227-3.337-2.286-7.066-2.286-9.852 0-3.503 1.811-7.064 4.736-7.064 4.122 0 7.107 4.094 11.31 4.094 4.092 0 7.193-2.61 8.643-6.398.503-1.31 1.59-2.103 2.91-2.103h12.34c5.21 0 9.435-4.226 9.435-9.435V64.913h-.073zM41.369 70.974c-2.18 0-3.95-2.115-3.95-4.724 0-2.61 1.77-4.724 3.95-4.724s3.95 2.115 3.95 4.724c0 2.61-1.77 4.724-3.95 4.724zm22.957 0c-2.18 0-3.95-2.115-3.95-4.724 0-2.61 1.77-4.724 3.95-4.724s3.95 2.115 3.95 4.724c0 2.61-1.77 4.724-3.95 4.724z"
      />
    </svg>
  );
}

export function WalletConnectLogo({ size = 16, className = '' }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-label="WalletConnect" role="img">
      <rect width="32" height="32" rx="8" fill="#3B99FC" />
      <path
        fill="#fff"
        d="M9.58 12.1a9.1 9.1 0 0 1 12.84 0l.43.42a.44.44 0 0 1 0 .63l-1.47 1.44a.23.23 0 0 1-.32 0l-.59-.58a6.34 6.34 0 0 0-8.94 0l-.63.62a.23.23 0 0 1-.32 0l-1.47-1.44a.44.44 0 0 1 0-.63l.47-.46Zm15.86 2.96 1.31 1.28a.44.44 0 0 1 0 .63l-5.9 5.78a.46.46 0 0 1-.65 0l-4.19-4.1a.12.12 0 0 0-.17 0l-4.19 4.1a.46.46 0 0 1-.65 0l-5.9-5.78a.44.44 0 0 1 0-.63l1.31-1.28a.46.46 0 0 1 .65 0l4.2 4.1a.12.12 0 0 0 .16 0l4.19-4.1a.46.46 0 0 1 .65 0l4.2 4.1a.12.12 0 0 0 .16 0l4.2-4.1a.46.46 0 0 1 .65 0Z"
      />
    </svg>
  );
}

export function NakaLogo({ size = 16, className = '' }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Naka Labs"
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}
