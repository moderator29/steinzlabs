import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildWalletRealizedPnl } from '@/lib/walletIntel/walletPnl';
import { getDexPriceForChain } from '@/lib/services/dexscreener';

export const runtime = 'nodejs';

// Wallet Cost-Basis & Realized PnL — the honest tax-style ledger for any wallet.
// Realized PnL comes from real DEX trades (Bitquery, each trade's USD is the
// value AT TRADE TIME, so cost basis is never fabricated from current prices),
// matched FIFO. On top of the realized side we surface the still-OPEN position
// per token (buys not yet sold) with its real weighted-average cost basis, and —
// where a live price is available — the UNREALIZED PnL against it. If no live
// price can be sourced for an open token, unrealized is null (—), not guessed.
//
// Degrades honestly: available:false when the trade source is off / the wallet
// has no priced trades in the window.

const Q = z.object({
  chain: z.string().min(1).max(32),
  address: z.string().min(8).max(128),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse({
    chain: req.nextUrl.searchParams.get('chain'),
    address: req.nextUrl.searchParams.get('address'),
    days: req.nextUrl.searchParams.get('days') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'chain and address required' }, { status: 400 });
  }
  const { chain, address } = parsed.data;
  const days = parsed.data.days ?? 90;
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    const pnl = await buildWalletRealizedPnl(chain, address, sinceIso);
    if (!pnl) {
      return NextResponse.json({
        available: false,
        reason: 'No priced DEX trades found for this wallet in the window, or the trade source is not configured.',
      });
    }

    // Enrich the open positions (top by cost basis) with a live price so we can
    // show real unrealized PnL. Cap the number of price lookups to stay fast.
    const openTokens = pnl.byToken
      .filter((t) => t.open && t.open.amount > 0)
      .sort((a, b) => (b.open!.costBasisUsd) - (a.open!.costBasisUsd))
      .slice(0, 12);

    const priceByToken = new Map<string, number>();
    await Promise.all(openTokens.map(async (t) => {
      const p = await getDexPriceForChain(t.token, chain).catch(() => 0);
      if (p > 0) priceByToken.set(t.token, p);
    }));

    let unrealizedTotal = 0;
    let unrealizedPriced = false;
    const rows = pnl.byToken.map((t) => {
      const open = t.open;
      const livePrice = open ? priceByToken.get(t.token) ?? null : null;
      let unrealizedUsd: number | null = null;
      let currentValueUsd: number | null = null;
      if (open && livePrice != null) {
        currentValueUsd = livePrice * open.amount;
        unrealizedUsd = currentValueUsd - open.costBasisUsd;
        unrealizedTotal += unrealizedUsd;
        unrealizedPriced = true;
      }
      return {
        token: t.token,
        symbol: t.tokenSymbol,
        realizedUsd: Math.round(t.totalRealizedUsd),
        costBasisUsd: Math.round(t.totalCostBasisUsd),
        proceedsUsd: Math.round(t.totalProceedsUsd),
        winRate: t.winRate,
        closedLots: t.lots,
        avgHoldDays: Number(t.averageHoldDays.toFixed(1)),
        openAmount: open ? open.amount : 0,
        openCostBasisUsd: open ? Math.round(open.costBasisUsd) : 0,
        avgEntryUsd: open ? open.avgCostPerUnit : null,
        currentPriceUsd: livePrice,
        currentValueUsd: currentValueUsd != null ? Math.round(currentValueUsd) : null,
        unrealizedUsd: unrealizedUsd != null ? Math.round(unrealizedUsd) : null,
      };
    });

    return NextResponse.json({
      available: true,
      chain: chain.toLowerCase(),
      address,
      windowDays: days,
      totalRealizedUsd: Math.round(pnl.totalRealizedUsd),
      totalCostBasisUsd: Math.round(pnl.totalCostBasisUsd),
      totalProceedsUsd: Math.round(pnl.totalProceedsUsd),
      closedLots: pnl.closedLots,
      winRate: pnl.winRate,
      averageHoldDays: Number(pnl.averageHoldDays.toFixed(1)),
      // Unrealized is null (not 0) when no open token could be live-priced, so
      // the UI shows "—" instead of implying a real $0 unrealized result.
      totalUnrealizedUsd: unrealizedPriced ? Math.round(unrealizedTotal) : null,
      tokens: rows,
    }, { headers: { 'Cache-Control': 'private, max-age=120' } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 502 });
  }
}
