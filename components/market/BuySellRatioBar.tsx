'use client';

// Buyers-vs-Sellers horizontal bar. Shows the 24h trade count split.
// Sits in the coin-detail right rail above RecentTradesRail.

interface Props {
  buys: number;
  sells: number;
  className?: string;
}

export default function BuySellRatioBar({ buys, sells, className = '' }: Props) {
  const total = buys + sells;
  if (total <= 0) return null;
  const pctBuy = Math.round((buys / total) * 100);
  const pctSell = 100 - pctBuy;

  return (
    <div className={`rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 text-xs ${className}`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold mb-2">
        <span className="text-emerald-400">{pctBuy}% Buyers</span>
        <span className="text-red-400">{pctSell}% Sellers</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden flex">
        <div className="bg-emerald-500 h-full" style={{ width: `${pctBuy}%` }} />
        <div className="bg-red-500 h-full" style={{ width: `${pctSell}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 tabular-nums">
        <span>{buys.toLocaleString()} buys</span>
        <span>{total.toLocaleString()} trades · 24h</span>
        <span>{sells.toLocaleString()} sells</span>
      </div>
    </div>
  );
}
