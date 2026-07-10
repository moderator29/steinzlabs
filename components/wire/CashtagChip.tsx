'use client';

import Link from 'next/link';
import { useCashtagPrices } from '@/lib/wire/cashtagPrices';
import { formatPrice } from '@/components/predict/utils';

/**
 * CashtagChip - an inline, tappable live-price chip for a `$SYMBOL` token in a
 * wire body. The price streams from the shared batched store (real feed only);
 * when the feed does not track the symbol the chip stays neutral (a dot, never a
 * fabricated number). Tapping opens the market for that symbol.
 */
export function CashtagChip({ symbol }: { symbol: string }) {
  const sym = symbol.toUpperCase();
  const prices = useCashtagPrices([sym]);
  const price = prices[sym];
  const hasPrice = typeof price === 'number' && Number.isFinite(price);

  return (
    <Link
      href={`/market?symbol=${encodeURIComponent(sym)}`}
      onClick={(e) => e.stopPropagation()}
      title={hasPrice ? `${sym} · $${formatPrice(price)}` : `${sym} market`}
      className="group/cash inline-flex items-center gap-1 rounded-md border border-[#0066FF]/25 bg-[#0066FF]/[0.08] px-1.5 py-[1px] align-baseline font-medium text-[#4d94ff] transition hover:border-[#0066FF]/45 hover:bg-[#0066FF]/15"
    >
      <span className="font-semibold tracking-tight">${sym}</span>
      {hasPrice ? (
        <span className="tabular-nums text-emerald-300/90">{formatPrice(price)}</span>
      ) : (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/25 group-hover/cash:bg-[#4d94ff]/60 transition" aria-hidden />
      )}
    </Link>
  );
}

export default CashtagChip;
