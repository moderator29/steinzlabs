import { redirect } from 'next/navigation';

/**
 * /market/prices/[tokenId] previously rendered its own CandlestickChart
 * via useChartData, but the OHLCV pipeline doesn't have data for every
 * token and the chart would silently render blank. The canonical
 * coin-detail page at /dashboard/market/[chain]/[address] uses
 * TradingView (always has data for indexed coins) plus the full
 * checkprice-style layout: chart + inline buy/sell + recent trades +
 * portfolio/history bottom. DexScreener fallback handles unindexed
 * contract-addr tokens via the /api/market/token/[id] route.
 *
 * One coin-detail surface, everywhere.
 */
export default async function MarketTokenRedirect({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  redirect(`/dashboard/market/ethereum/${tokenId}`);
}
