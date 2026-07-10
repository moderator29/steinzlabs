'use client';

import { useState, useEffect } from 'react';
import {
  Users, Copy, Check, ExternalLink, Coins, AlertTriangle,
  Loader2, FileCode2, ArrowRight,
} from 'lucide-react';
import { getExplorerUrl } from '@/lib/chain-explorer';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * RelatedTokensPanels — read-only companion panels for the Contract Analyzer
 * VALID result view, mirroring MEVX parity (#66):
 *
 *   - Similar Tokens: other tokens sharing the queried token's ticker. These
 *     are NOT the same token (impersonators / older launches). Real DexScreener
 *     data via /api/security/related.
 *   - Related Wallets: creator + owner + top holders for the token. Real GoPlus
 *     data. Copy + explorer link per address.
 *
 * Non-custodial, no writes. Honest empty states — never fabricated rows.
 */

interface SimilarToken {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  liquidityUsd: number;
  marketCap: number;
  imageUrl: string | null;
  ageMs: number | null;
  url: string;
}

interface RelatedHolder {
  address: string;
  percent: number;
  isContract: boolean;
  tag?: string;
}

interface RelatedData {
  creatorAddress: string | null;
  ownerAddress: string | null;
  holders: RelatedHolder[];
  similarTokens: SimilarToken[];
}

export interface RelatedTokensPanelsProps {
  address: string;
  chain: string;
  symbol?: string;
}

function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function ageLabel(ms: number | null): string | null {
  if (ms == null || ms < 0) return null;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}m`;
}

function AddressRow({
  address,
  chain,
  role,
  roleColor,
  percent,
  isContract,
  tag,
}: {
  address: string;
  chain: string;
  role: string;
  roleColor: string;
  percent?: number;
  isContract?: boolean;
  tag?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked — no-op */ }
  };
  return (
    <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-2.5 py-2">
      <span
        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0"
        style={{ backgroundColor: `${roleColor}1f`, color: roleColor }}
      >
        {role}
      </span>
      <span className="text-[11px] font-mono text-gray-300 truncate">{shortAddr(address)}</span>
      {isContract && (
        <span className="flex items-center gap-0.5 text-[9px] text-slate-400" title="Contract address">
          <FileCode2 className="w-3 h-3" />
        </span>
      )}
      {tag && (
        <span className="text-[9px] text-amber-300 truncate max-w-[80px]" title={tag}>{tag}</span>
      )}
      {typeof percent === 'number' && (
        <span className="ms-auto text-[11px] font-mono font-bold text-blue-300 tabular-nums flex-shrink-0">
          {(percent * 100).toFixed(percent >= 0.01 ? 1 : 2)}%
        </span>
      )}
      <div className={`flex items-center gap-1 flex-shrink-0 ${typeof percent === 'number' ? '' : 'ms-auto'}`}>
        <button
          onClick={copy}
          className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Copy address"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
        <a
          href={getExplorerUrl(chain, address)}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="View on explorer"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export function RelatedTokensPanels({ address, chain, symbol }: RelatedTokensPanelsProps) {
  const [data, setData] = useState<RelatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setData(null);
    (async () => {
      try {
        const res = await fetch('/api/security/related', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, chain, symbol }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setFailed(true); return; }
        setData(json as RelatedData);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address, chain, symbol]);

  if (loading) {
    return (
      <div className="nl-glass rounded-2xl p-6 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#0066FF]" />
        <span className="text-[11px] text-gray-500">Loading related tokens and wallets...</span>
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="nl-glass rounded-2xl p-4 flex items-center gap-2.5" style={{ boxShadow: '0 0 0 1px rgba(148,163,184,.25)' }}>
        <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <p className="text-[11px] text-gray-500">Related token and wallet data is temporarily unavailable.</p>
      </div>
    );
  }

  const { similarTokens, creatorAddress, ownerAddress, holders } = data;
  const hasWallets = Boolean(creatorAddress) || Boolean(ownerAddress) || holders.length > 0;
  // Don't list the creator/owner twice if they also appear in the holders list.
  const dedupedHolders = holders.filter((h) => {
    if (creatorAddress && normalizeAddress(h.address, chain) === normalizeAddress(creatorAddress, chain)) return false;
    if (ownerAddress && normalizeAddress(h.address, chain) === normalizeAddress(ownerAddress, chain)) return false;
    return true;
  });
  const walletCount = dedupedHolders.length + (creatorAddress ? 1 : 0) + (ownerAddress ? 1 : 0);

  return (
    <>
      {/* ── SIMILAR TOKENS ──────────────────────────────────────────── */}
      <div className="nl-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-[#0066FF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Coins className="w-4 h-4 text-[#0066FF]" />
          </div>
          <span className="font-bold text-sm">Similar Tokens</span>
          {similarTokens.length > 0 && (
            <span className="ms-auto text-[10px] text-gray-500">{similarTokens.length} sharing this ticker</span>
          )}
        </div>
        <p className="text-[10px] text-amber-400/90 mb-3 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          These tokens share the ticker but are NOT the same token. Verify the address before trading.
        </p>

        {similarTokens.length === 0 ? (
          <p className="text-[11px] text-gray-600 text-center py-4">No other tokens found sharing this ticker.</p>
        ) : (
          <div className="space-y-2">
            {similarTokens.map((t) => {
              const age = ageLabel(t.ageMs);
              return (
                <a
                  key={`${t.chain}:${t.address}`}
                  href={`/dashboard/contract-analyzer?address=${encodeURIComponent(t.address)}&chain=${encodeURIComponent(t.chain)}`}
                  className="group flex items-center gap-2.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl p-2.5 transition-colors"
                >
                  {t.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.imageUrl}
                      alt={t.symbol}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10"
                      onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                  ) : (
                    <div className="w-8 h-8 bg-[#0066FF]/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Coins className="w-4 h-4 text-[#0066FF]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">{t.symbol || 'Token'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 capitalize flex-shrink-0">{t.chain}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 truncate block">{t.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-mono font-bold">{compactUsd(t.liquidityUsd)}</p>
                    <p className="text-[9px] text-gray-500">
                      Liq{t.marketCap > 0 ? ` · MC ${compactUsd(t.marketCap)}` : ''}{age ? ` · ${age}` : ''}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#0066FF] transition-colors flex-shrink-0" />
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RELATED WALLETS ─────────────────────────────────────────── */}
      <div className="nl-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-[#0066FF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-[#0066FF]" />
          </div>
          <span className="font-bold text-sm">Related Wallets</span>
          {walletCount > 0 && (
            <span className="ms-auto text-[10px] text-gray-500">{walletCount} address{walletCount === 1 ? '' : 'es'}</span>
          )}
        </div>

        {!hasWallets ? (
          <p className="text-[11px] text-gray-600 text-center py-4">No creator, owner, or holder data available for this token.</p>
        ) : (
          <div className="space-y-2">
            {creatorAddress && (
              <AddressRow address={creatorAddress} chain={chain} role="Creator" roleColor="#EF4444" />
            )}
            {ownerAddress && (
              <AddressRow address={ownerAddress} chain={chain} role="Owner" roleColor="#F59E0B" />
            )}
            {dedupedHolders.map((h) => (
              <AddressRow
                key={h.address}
                address={h.address}
                chain={chain}
                role="Holder"
                roleColor="#0066FF"
                percent={h.percent}
                isContract={h.isContract}
                tag={h.tag}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
