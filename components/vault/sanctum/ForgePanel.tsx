'use client';

import { useEffect, useState } from 'react';

interface ForgePiece {
  chain: string;
  contract: string;
  tokenId: string;
  name: string;
  collection: string;
  image: string | null;
  description: string | null;
}

interface ForgeResponse {
  pieces: ForgePiece[];
  addresses: string[];
  offline?: boolean;
  offlineReason?: string;
}

/**
 * The Forge · auto-discovered NFT gallery for the caller's connected EVM
 * wallets. Real Alchemy data only; the chamber shows an explicit empty /
 * offline state instead of mock pieces when keys are missing or wallets
 * carry nothing.
 *
 * The "3D rotation" lives in pure CSS · a slow Y-axis tilt on hover/focus
 * via transform: rotateY(). No three.js, no extra dep; the brand spec
 * just wants the gallery to feel alive when you hover a piece.
 */
export function ForgePanel() {
  const [state, setState] = useState<ForgeResponse | null>(null);
  const [activeChain, setActiveChain] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/sanctum/forge', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ForgeResponse | null) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  const chains = Array.from(new Set(state.pieces.map((p) => p.chain))).sort();
  const filtered =
    activeChain === 'all' ? state.pieces : state.pieces.filter((p) => p.chain === activeChain);

  return (
    <article className="sanctum-subchamber sanctum-subchamber--forge" aria-label="The Forge">
      <header className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#00C8FF]">The Forge</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#B4C0E0]">
          {state.pieces.length} pieces · {state.addresses.length} wallets
        </span>
      </header>
      <h3 className="sanctum-subchamber__title">The sigils you hold</h3>
      <p className="sanctum-subchamber__tagline">
        Auto-detected. Hover to rotate; click to follow on-chain.
      </p>

      {state.offline ? (
        <p className="mt-4 text-[12px] text-[#FFD86B]">
          The forge is offline · wallet intelligence keys are not configured.
        </p>
      ) : state.pieces.length === 0 ? (
        <p className="mt-4 text-[12px] text-[#7F8AA8]">
          {state.addresses.length === 0
            ? 'Connect a wallet to see the sigils you carry.'
            : 'No NFTs detected on your connected wallets yet.'}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveChain('all')}
              aria-pressed={activeChain === 'all'}
              className={`rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
                activeChain === 'all'
                  ? 'border-[#00C8FF]/60 text-white bg-[#00C8FF]/[0.08]'
                  : 'border-white/10 text-[#B4C0E0] hover:bg-white/[0.04]'
              }`}
            >
              All
            </button>
            {chains.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveChain(c)}
                aria-pressed={activeChain === c}
                className={`rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
                  activeChain === c
                    ? 'border-[#00C8FF]/60 text-white bg-[#00C8FF]/[0.08]'
                    : 'border-white/10 text-[#B4C0E0] hover:bg-white/[0.04]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <ul
            className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3"
            style={{ perspective: '900px' }}
          >
            {filtered.map((p) => (
              <li key={`${p.chain}:${p.contract}:${p.tokenId}`}>
                <a
                  href={
                    p.chain === 'ethereum'
                      ? `https://etherscan.io/token/${p.contract}?a=${p.tokenId}`
                      : p.chain === 'base'
                        ? `https://basescan.org/token/${p.contract}?a=${p.tokenId}`
                        : p.chain === 'polygon'
                          ? `https://polygonscan.com/token/${p.contract}?a=${p.tokenId}`
                          : p.chain === 'arbitrum'
                            ? `https://arbiscan.io/token/${p.contract}?a=${p.tokenId}`
                            : p.chain === 'optimism'
                              ? `https://optimistic.etherscan.io/token/${p.contract}?a=${p.tokenId}`
                              : '#'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-white/10 bg-white/[0.03] p-2 transition-transform duration-500 motion-safe:hover:[transform:rotateY(15deg)_translateZ(8px)] motion-safe:focus-visible:[transform:rotateY(15deg)_translateZ(8px)] focus-visible:ring-2 focus-visible:ring-[#00C8FF]"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div
                    className="aspect-square w-full rounded-md overflow-hidden bg-[#0b1022] flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[#7F8AA8]">
                        no preview
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-white truncate">{p.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#B4C0E0] truncate">
                    {p.chain} · {p.collection || '·'}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="sanctum-subchamber__seam" aria-hidden="true" />
    </article>
  );
}
