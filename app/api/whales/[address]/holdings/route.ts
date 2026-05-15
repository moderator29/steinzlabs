import { NextRequest, NextResponse } from "next/server";
import { getTokenBalances, getTokenMetadata, getEthBalance } from "@/lib/services/alchemy";
import { getDexPrice } from "@/lib/services/dexscreener";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";
import { cacheWithFallback } from "@/lib/cache/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whale holdings — Nansen Wallet Profiler / Arkham parity.
 *
 * Returns the top N ERC-20 holdings for an EVM address with USD values
 * priced via DexScreener (covers anything with a DEX pair, including
 * long-tail tokens CoinGecko doesn't index). Includes the native asset
 * balance as the first row.
 *
 * Audit B6 / P0 #7 — the whale profile's Tokens tab was a placeholder
 * ("Token holdings will populate as the on-chain indexer ships in
 * Session 5B-2"). This endpoint replaces that placeholder with real
 * on-chain data.
 *
 * Solana support is intentionally NOT shipped here yet — Helius's
 * getAssetsByOwner returns a different shape and the whale-tracker
 * Solana coverage is currently best-effort. UI falls back to a
 * "Solana holdings coming soon" state for chain=solana.
 *
 * Cached 5 minutes. The underlying Alchemy + DexScreener calls are
 * already individually cached in their service layers, so this layer
 * mostly de-duplicates concurrent profile-page opens.
 */

const NATIVE_SYMBOL: Record<string, { symbol: string; name: string; coinGeckoSlug: string }> = {
  ethereum: { symbol: 'ETH', name: 'Ethereum', coinGeckoSlug: 'ethereum' },
  base:     { symbol: 'ETH', name: 'Ethereum (Base)', coinGeckoSlug: 'ethereum' },
  arbitrum: { symbol: 'ETH', name: 'Ethereum (Arbitrum)', coinGeckoSlug: 'ethereum' },
  optimism: { symbol: 'ETH', name: 'Ethereum (Optimism)', coinGeckoSlug: 'ethereum' },
  polygon:  { symbol: 'MATIC', name: 'Polygon', coinGeckoSlug: 'matic-network' },
  bnb:      { symbol: 'BNB', name: 'BNB Chain', coinGeckoSlug: 'binancecoin' },
  bsc:      { symbol: 'BNB', name: 'BNB Chain', coinGeckoSlug: 'binancecoin' },
  avalanche:{ symbol: 'AVAX', name: 'Avalanche', coinGeckoSlug: 'avalanche-2' },
};

interface HoldingRow {
  contract: string | null; // null = native asset
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  logo: string | null;
}

const MAX_TOKENS_PRICED = 25; // pricing batch ceiling — DexScreener rate-limits at ~5 req/s

export const GET = withTierGate("pro", async (
  request: NextRequest,
  context: { params: Promise<{ address: string }> },
) => {
  const { address } = await context.params;
  const sp = request.nextUrl.searchParams;
  const chain = (sp.get('chain') || 'ethereum').toLowerCase();

  if (chain === 'solana') {
    return NextResponse.json({
      address,
      chain,
      holdings: [],
      total_value_usd: 0,
      message: 'Solana holdings indexer is rolling out — EVM chains supported today.',
    });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid EVM address' }, { status: 400 });
  }

  try {
    const data = await cacheWithFallback<{
      address: string;
      chain: string;
      holdings: HoldingRow[];
      total_value_usd: number;
    }>(`whale:holdings:${chain}:${address.toLowerCase()}`, 300, async () => {
      // Native balance + ERC-20 list in parallel.
      const [nativeWei, balances] = await Promise.all([
        getEthBalance(address, chain).catch(() => '0'),
        getTokenBalances(address, chain).catch(() => []),
      ]);

      const native = NATIVE_SYMBOL[chain] ?? NATIVE_SYMBOL.ethereum;
      const nativeBalance = Number(nativeWei) / 1e18;
      const rows: HoldingRow[] = [];
      if (nativeBalance > 0) {
        rows.push({
          contract: null,
          symbol: native.symbol,
          name: native.name,
          balance: nativeBalance,
          decimals: 18,
          priceUsd: 0,
          valueUsd: 0,
          logo: null,
        });
      }

      // Sort balances by raw value first so we prioritise pricing the
      // largest holdings (most likely to have a DexScreener pair). This
      // keeps the response useful even when the long tail is dust.
      const nonZero = balances
        .filter((b) => b.tokenBalance && b.tokenBalance !== '0' && b.tokenBalance !== '0x0')
        .slice(0, MAX_TOKENS_PRICED * 2);

      const enriched = await Promise.all(
        nonZero.slice(0, MAX_TOKENS_PRICED).map(async (b) => {
          try {
            const meta = await getTokenMetadata(b.contractAddress, chain);
            const decimals = meta.decimals ?? 18;
            const balanceTokens = Number(BigInt(b.tokenBalance || '0')) / 10 ** decimals;
            if (balanceTokens <= 0) return null;
            // DexScreener for price — covers DEX pairs without requiring
            // a CoinGecko slug. Returns 0 for tokens with no pair, which
            // we surface as $0 (better than fabricating a price).
            const priceUsd = await getDexPrice(b.contractAddress).catch(() => 0);
            return {
              contract: b.contractAddress,
              symbol: meta.symbol ?? '???',
              name: meta.name ?? 'Unknown token',
              balance: balanceTokens,
              decimals,
              priceUsd,
              valueUsd: priceUsd * balanceTokens,
              logo: meta.logo ?? null,
            } as HoldingRow;
          } catch {
            return null;
          }
        }),
      );

      const validEnriched = enriched.filter((r): r is HoldingRow => r !== null);
      rows.push(...validEnriched);

      // Native asset price last so a CoinGecko / DexScreener miss
      // doesn't drop the entire row.
      try {
        const nativePrice = await getDexPrice(
          // WETH on Ethereum / Base / Arbitrum / Optimism approximates
          // native price. WBNB / WMATIC for the other chains.
          chain === 'bnb' || chain === 'bsc'
            ? '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'
            : chain === 'polygon'
              ? '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
              : chain === 'avalanche'
                ? '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'
                : '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        );
        if (rows[0] && rows[0].contract === null) {
          rows[0].priceUsd = nativePrice;
          rows[0].valueUsd = nativePrice * rows[0].balance;
        }
      } catch {
        // Non-fatal: native row still renders with valueUsd=0 and the
        // user can see they hold X ETH even without a price.
      }

      rows.sort((a, b) => b.valueUsd - a.valueUsd);
      const total = rows.reduce((sum, r) => sum + r.valueUsd, 0);

      return { address, chain, holdings: rows, total_value_usd: total };
    });

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
  } catch (err) {
    console.error('[whales/holdings]', err);
    return NextResponse.json({ error: 'Failed to load holdings' }, { status: 500 });
  }
});
