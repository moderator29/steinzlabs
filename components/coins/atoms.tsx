'use client';

/**
 * Small shared building blocks for the Coins surfaces. Real logos, brand
 * colors, flat icons, no arrows. Every value falls back to an honest empty
 * state rather than an invented one.
 */

import { useState } from 'react';
import { BadgeCheck, Copy, Check } from 'lucide-react';
import { CHAIN_META } from '@/lib/chains/chainMeta';
import { signedPct, COIN_NULL } from '@/lib/coins/format';

/** Small chain logo chip (real vendored logo). */
export function ChainBadge({ chain, size = 14, className = '' }: { chain: string; size?: number; className?: string }) {
  const meta = CHAIN_META[chain];
  if (!meta) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={meta.logo} alt={meta.short} width={size} height={size} className={`rounded-full ${className}`} style={{ width: size, height: size }} />
  );
}

/** Coin avatar with a real logo, lettered fallback, and a corner chain badge. */
export function CoinLogo({ logoUrl, symbol, chain, size = 44, verified = false }: {
  logoUrl: string | null;
  symbol: string;
  chain: string;
  size?: number;
  verified?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const letter = (symbol || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {logoUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={symbol}
          onError={() => setBroken(true)}
          className="rounded-full object-cover w-full h-full bg-white/[0.04]"
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-bold text-white w-full h-full"
          style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#7C3AED)', fontSize: size * 0.4 }}
        >
          {letter}
        </div>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[#080b14]">
        <ChainBadge chain={chain} size={Math.max(12, size * 0.32)} />
      </span>
      {verified ? (
        <span className="absolute -top-0.5 -right-0.5 text-[#3B9EFF]">
          <BadgeCheck className="w-3.5 h-3.5 fill-[#0b1022]" />
        </span>
      ) : null}
    </div>
  );
}

/** Colored signed percentage. Emerald up, rose down, no arrow icons. */
export function PriceDelta({ value, className = '', decimals = 2 }: { value: number | null | undefined; className?: string; decimals?: number }) {
  if (value == null || !Number.isFinite(value)) return <span className={`text-white/40 ${className}`}>{COIN_NULL}</span>;
  const up = value >= 0;
  return (
    <span className={`${up ? 'text-emerald-400' : 'text-rose-400'} tabular-nums ${className}`}>
      {signedPct(value, decimals)}
    </span>
  );
}

/** Inline verified tick (our admin verification). */
export function VerifiedTick({ size = 15 }: { size?: number }) {
  return <BadgeCheck className="text-[#3B9EFF]" style={{ width: size, height: size }} />;
}

/** Tap-to-copy chip used for contract address and market cap. */
export function Copyable({ text, label, className = '' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard may be blocked; no-op */ }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors ${className}`}
    >
      {label ? <span className="truncate">{label}</span> : null}
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}
