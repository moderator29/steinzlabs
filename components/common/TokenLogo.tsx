'use client';

import { useState, useEffect } from 'react';
import { tokenLogoCandidates } from '@/lib/wallet/tokenLogoCandidates';

interface TokenMetadata {
  symbol: string;
  name: string;
  logo: string | null;
}

interface TokenLogoProps {
  /** Token contract address — metadata fetched client-side via Dexscreener */
  address: string;
  chain?: string;
  size?: number;
  showSymbol?: boolean;
  className?: string;
}

const cache = new Map<string, TokenMetadata>();

async function fetchTokenMeta(address: string, chain: string): Promise<TokenMetadata> {
  const key = `${chain}:${address}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const pairs: any[] = data.pairs ?? [];
    if (!pairs.length) throw new Error('no pairs');
    const best = pairs.reduce((a: any, b: any) =>
      parseFloat(a.liquidity?.usd || '0') > parseFloat(b.liquidity?.usd || '0') ? a : b
    );
    const meta: TokenMetadata = {
      symbol: best.baseToken.symbol || address.slice(0, 6).toUpperCase(),
      name: best.baseToken.name || 'Unknown',
      logo: best.info?.imageUrl ?? null,
    };
    cache.set(key, meta);
    return meta;
  } catch {
    const fallback: TokenMetadata = {
      symbol: address.slice(0, 6).toUpperCase(),
      name: `Token ${address.slice(0, 8)}`,
      logo: null,
    };
    cache.set(key, fallback);
    return fallback;
  }
}

// Deterministic color from symbol
function symbolColor(symbol: string): string {
  const colors = [
    '#0066FF', '#8B5CF6', '#EC4899', '#F59E0B',
    '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
  ];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

export function TokenLogo({ address, chain = 'ethereum', size = 32, showSymbol = false, className = '' }: TokenLogoProps) {
  const [meta, setMeta] = useState<TokenMetadata | null>(null);
  // Cascade through real logo candidates (indexer image → Trust Wallet asset
  // registry) before giving up to a lettered avatar, so a valid CA that
  // DexScreener has no image for still shows real token art when the registry
  // hosts it.
  const [candidateIdx, setCandidateIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCandidateIdx(0);
    fetchTokenMeta(address, chain).then((m) => { if (!cancelled) setMeta(m); });
    return () => { cancelled = true; };
  }, [address, chain]);

  const letter = meta?.symbol?.slice(0, 1) ?? address.slice(0, 1).toUpperCase();
  const color = symbolColor(meta?.symbol ?? address);
  const candidates = meta ? tokenLogoCandidates({ primary: meta.logo, address, chain }) : [];
  const currentLogo = candidates[candidateIdx];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {currentLogo ? (
        <img
          src={currentLogo}
          alt={meta?.symbol ?? ''}
          className="rounded-full object-cover flex-shrink-0"
          style={{ width: size, height: size }}
          onError={() => setCandidateIdx((i) => i + 1)}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{ width: size, height: size, backgroundColor: color, fontSize: Math.max(size * 0.38, 10) }}
        >
          {meta ? letter : '?'}
        </div>
      )}
      {showSymbol && meta && (
        <div>
          <div className="font-medium text-white text-sm">{meta.symbol}</div>
          <div className="text-xs text-gray-500 truncate max-w-[120px]">{meta.name}</div>
        </div>
      )}
    </div>
  );
}
