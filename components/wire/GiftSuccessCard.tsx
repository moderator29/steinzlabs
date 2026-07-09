'use client';

import { ExternalLink } from '@/components/icons/brand';
import { Gift } from 'lucide-react';
import { getGiftChain } from '@/lib/wallet/giftSend';

export interface GiftSuccessData {
  recipient: { username: string; display_name?: string | null; avatar_url?: string | null };
  amount: string;
  tokenSymbol: string;
  /** Canonical gift chain id ('ethereum' | 'base' | 'bsc' | 'solana'). */
  chainId: string;
  txHash: string;
  amountUsd?: number | null;
}

/**
 * Celebratory glass card shown after a Wire gift lands on-chain.
 * "You gifted @username 0.05 ETH 🎁" + avatar + explorer link.
 */
export function GiftSuccessCard({ data, onClose }: { data: GiftSuccessData; onClose?: () => void }) {
  const chain = getGiftChain(data.chainId);
  const explorerHref = chain ? `${chain.explorerUrl}/tx/${data.txHash}` : null;
  const initial = (data.recipient.display_name || data.recipient.username || '?').slice(0, 1).toUpperCase();

  return (
    <div
      className="nl-glass rounded-3xl p-6 text-center text-white max-w-sm mx-auto"
      style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.3), 0 0 40px rgba(0,102,255,.25)' }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: 'linear-gradient(135deg,#1E90FF,#0066FF 60%,#1233AE)', boxShadow: '0 0 22px rgba(0,102,255,.55)' }}
      >
        <Gift className="w-8 h-8 text-white" />
      </div>

      <div className="flex items-center justify-center gap-2 mb-3">
        {data.recipient.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.recipient.avatar_url} alt={data.recipient.username} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-white/10">{initial}</div>
        )}
      </div>

      <h2 className="text-lg font-heading font-bold leading-snug">
        You gifted <span className="text-[#8FA3FF]">@{data.recipient.username}</span>
      </h2>
      <div className="text-2xl font-bold mt-1">
        {data.amount} {data.tokenSymbol} <span className="align-middle">🎁</span>
      </div>
      {data.amountUsd != null && (
        <div className="text-sm text-slate-400 mt-0.5">
          ≈ ${data.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      )}

      {explorerHref && (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="nl-glass mt-5 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[#8FA3FF] text-sm font-semibold"
          style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.3)' }}
        >
          View on {chain?.explorerName ?? 'explorer'} <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="w-full mt-3 py-3 rounded-2xl font-bold text-sm nl-glass"
          style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.22)' }}
        >
          Done
        </button>
      )}
    </div>
  );
}
