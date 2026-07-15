'use client';

/**
 * One-tap funding (rec 15). Opens the real hosted fiat on-ramp for the user's
 * own wallet address on a specific chain so a new user can fund and make a first
 * trade in under a minute. When the on-ramp is not configured (no provider env
 * key), or we have no address, it falls back to the wallet tab which carries the
 * full deposit flow. Never a fake flow. The chain must match the given address
 * so funds are always delivered to the right network.
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getOnrampUrl } from '@/lib/wallet/onramp';
import { isSolanaAddress } from '@/lib/utils/addressNormalize';

/** Funds-safety: only build an on-ramp URL when the address format matches the
 *  chain, so the provider never delivers to the wrong network. */
function addressMatchesChain(address: string, chain: string): boolean {
  if (chain === 'solana') return isSolanaAddress(address);
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function FundButton({
  address,
  chain,
  label = 'Fund with card',
  className,
}: {
  address: string | null | undefined;
  chain: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const onClick = useCallback(() => {
    // Only open the direct on-ramp when the address genuinely belongs to this
    // chain; otherwise route to the wallet, which resolves the correct per-chain
    // address (e.g. the derived Solana address) before funding.
    const url = address && addressMatchesChain(address, chain) ? getOnrampUrl({ address, chain }) : null;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else router.push('/dashboard?tab=wallet');
  }, [address, chain, router]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={className ?? 'w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-[#7FB2FF] bg-[#0066FF]/10 border border-[#0066FF]/25 hover:text-white transition-colors'}
    >
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
