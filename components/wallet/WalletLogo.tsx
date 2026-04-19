// FIX 5A.1: was emoji icons (🦊 👻) for MetaMask/Phantom; now inline-SVG brand marks.
// Marks kept small and geometric to respect brand guidelines (no stretched/recolored originals).

import React from 'react';

export function MetaMaskLogo({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-label="MetaMask">
      <path fill="#E17726" d="M30 3 17.9 11.9l2.3-5.4z" />
      <path fill="#E27625" d="m2 3 12 9-2.2-5.5zM25.6 22.6 22.4 27.5l6.9 1.9 2-6.6zM.6 22.8l2 6 6.8-1.9-3.1-4.9z" />
      <path fill="#E27625" d="M9 14.2 7 17.2l6.7.3-.2-7.2zM23 14.2l-4.6-3.9-.2 7.5 6.7-.3zM9.4 27.5l4.1-2-3.5-2.7zM18.5 25.5l4 2 .6-4.7z" />
      <path fill="#D5BFB2" d="m22.5 27.5-4-2 .3 2.6v1.2zM9.4 27.5l3.7 1.8V28l.3-2.6z" />
      <path fill="#233447" d="m13.2 20.6-3.4-1 2.4-1.1zM18.8 20.6l1-2.1 2.4 1.1z" />
      <path fill="#CC6228" d="m9.4 27.5.6-4.9-3.8.1zM22 22.6l.5 4.9 3.2-4.8zM24.9 17.5l-6.7.3.6 3.4 1-2.1 2.4 1.1zM9.8 19.6l2.4-1.1 1 2.1.6-3.4-6.7-.3z" />
      <path fill="#E27525" d="m7.1 17.2 2.8 5.6-.1-2.8zM22.3 20 22 22.8l2.9-5.6zM13.7 17.5l-.6 3.4.8 4.2.2-5.6zM18.2 17.5l-.3 2 .2 5.6.8-4.2z" />
      <path fill="#F5841F" d="m18.9 20.5-.8 4.2.6.4 3.5-2.7.1-2.8zM9.8 19.6l.1 2.8 3.5 2.7.6-.4-.8-4.2z" />
      <path fill="#C0AC9D" d="m19 29.3.1-1.2-.3-.3h-5.5l-.3.3v1.2L9.4 27.5l1.3 1.1 2.6 1.8h5.4l2.6-1.8 1.3-1.1z" />
      <path fill="#161616" d="m18.5 25.5-.6-.4h-3.8l-.6.4-.3 2.6.3-.3h5.1l.3.3z" />
    </svg>
  );
}

export function PhantomLogo({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className={className} aria-label="Phantom">
      <defs>
        <linearGradient id="phg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#534BB1" />
          <stop offset="100%" stopColor="#551BF9" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#phg)" />
      <path
        fill="#fff"
        d="M110.584 64.914c0 25.828-20.93 46.758-46.758 46.758S17.068 90.742 17.068 64.914C17.068 39.086 38 18.156 63.826 18.156s46.758 20.93 46.758 46.758Zm-69.215-2.457c-1.937 0-3.508 1.568-3.508 3.503 0 1.935 1.571 3.503 3.508 3.503 1.937 0 3.508-1.568 3.508-3.503 0-1.935-1.571-3.503-3.508-3.503Zm28.17 0c-1.937 0-3.508 1.568-3.508 3.503 0 1.935 1.571 3.503 3.508 3.503 1.937 0 3.508-1.568 3.508-3.503 0-1.935-1.571-3.503-3.508-3.503Z"
      />
    </svg>
  );
}

export function WalletConnectLogo({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-label="WalletConnect">
      <rect width="32" height="32" rx="8" fill="#3B99FC" />
      <path
        fill="#fff"
        d="M9.58 12.1a9.1 9.1 0 0 1 12.84 0l.43.42a.44.44 0 0 1 0 .63l-1.47 1.44a.23.23 0 0 1-.32 0l-.59-.58a6.34 6.34 0 0 0-8.94 0l-.63.62a.23.23 0 0 1-.32 0l-1.47-1.44a.44.44 0 0 1 0-.63l.47-.46Zm15.86 2.96 1.31 1.28a.44.44 0 0 1 0 .63l-5.9 5.78a.46.46 0 0 1-.65 0l-4.19-4.1a.12.12 0 0 0-.17 0l-4.19 4.1a.46.46 0 0 1-.65 0l-5.9-5.78a.44.44 0 0 1 0-.63l1.31-1.28a.46.46 0 0 1 .65 0l4.2 4.1a.12.12 0 0 0 .16 0l4.19-4.1a.46.46 0 0 1 .65 0l4.2 4.1a.12.12 0 0 0 .16 0l4.2-4.1a.46.46 0 0 1 .65 0Z"
      />
    </svg>
  );
}

export function NakaLogo({ size = 16, className = '' }: { size?: number; className?: string }) {
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
