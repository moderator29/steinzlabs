'use client';

export function SolanaIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 397.7 311.7" fill="none" xmlns="http://www.w3.org/2000/svg">
      <linearGradient id="sol-a" x1="360.879" y1="351.455" x2="141.213" y2="-69.294" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 -1 0 314)">
        <stop offset="0" stopColor="#00FFA3"/>
        <stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#sol-a)"/>
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#sol-a)"/>
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#sol-a)"/>
    </svg>
  );
}

export function EthereumIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fill="#343434"/>
      <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" fill="#8C8C8C"/>
      <path d="M127.961 312.187l-1.575 1.919v98.199l1.575 4.601L256 236.587z" fill="#3C3C3B"/>
      <path d="M127.962 416.905v-104.72L0 236.585z" fill="#8C8C8C"/>
      <path d="M127.961 287.958l127.96-75.637-127.96-58.162z" fill="#141414"/>
      <path d="M0 212.32l127.96 75.638v-133.8z" fill="#393939"/>
    </svg>
  );
}

export function BscIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 126.611 126.611" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path d="M38.171 53.203L63.306 28.068 88.449 53.211 103.265 38.395 63.306 -1.564e-15 23.346 39.96z" fill="#F0B90B"/>
        <path d="M0 63.306L15.014 48.293 30.028 63.306 15.014 78.319z" fill="#F0B90B"/>
        <path d="M38.171 73.408L63.306 98.543 88.449 73.4 103.273 88.208 63.306 126.611 23.346 86.651 23.338 86.643z" fill="#F0B90B"/>
        <path d="M96.583 78.327L111.597 63.314 126.611 78.327 111.597 93.34z" fill="#F0B90B" transform="rotate(-45 111.597 78.327) scale(1) rotate(45)"/>
        <path d="M78.037 63.298L63.306 48.567 52.126 59.747 50.86 61.013 48.583 63.29 48.575 63.298 48.583 63.314 63.306 78.037 78.045 63.298z" fill="#F0B90B"/>
      </g>
    </svg>
  );
}

export function PolygonIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38.4 33.5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M29 10.2c-.7-.4-1.6-.4-2.4 0L21 13.5l-3.8 2.1-5.5 3.3c-.7.4-1.6.4-2.4 0L5 16.3c-.7-.4-1.2-1.2-1.2-2.1v-5c0-.8.4-1.6 1.2-2.1l4.3-2.5c.7-.4 1.6-.4 2.4 0L16 7.2c.7.4 1.2 1.2 1.2 2.1v3.3l3.8-2.2V7c0-.8-.4-1.6-1.2-2.1l-8-4.7c-.7-.4-1.6-.4-2.4 0L1.2 5C.4 5.4 0 6.2 0 7v9.4c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l5.5-3.2 3.8-2.2 5.5-3.2c.7-.4 1.6-.4 2.4 0l4.3 2.5c.7.4 1.2 1.2 1.2 2.1v5c0 .8-.4 1.6-1.2 2.1L29 28.8c-.7.4-1.6.4-2.4 0l-4.3-2.5c-.7-.4-1.2-1.2-1.2-2.1v-3.3l-3.8 2.2v3.4c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l8.1-4.7c.7-.4 1.2-1.2 1.2-2.1V17c0-.8-.4-1.6-1.2-2.1L29 10.2z" fill="#8247E5"/>
    </svg>
  );
}

export function AvalancheIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 254 254" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="127" cy="127" r="127" fill="#E84142"/>
      <path d="M171.8 130.3c4.4-7.6 11.5-7.6 15.9 0l27.4 48.1c4.4 7.6.8 13.8-8 13.8h-55.5c-8.7 0-12.3-6.2-8-13.8l28.2-48.1zM118.8 44.2c4.4-7.6 11.4-7.6 15.8 0l5.4 9.8 12.8 23.3c3.5 7.2 3.5 15.7 0 22.9l-34.4 59.6c-4.4 7.6-11.5 12.4-19.6 13.1H46.5c-8.8 0-12.4-6.1-8-13.8l80.3-114.9z" fill="white"/>
    </svg>
  );
}

export function AllChainsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="url(#all-grad)" strokeWidth="2"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="url(#all-grad)" strokeWidth="1.5"/>
      <defs>
        <linearGradient id="all-grad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#00E5FF"/>
          <stop offset="1" stopColor="#7C3AED"/>
        </linearGradient>
      </defs>
    </svg>
  );
}
