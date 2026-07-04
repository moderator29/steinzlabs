import { searchDEXScreener } from './dexscreener';
import { getTokenHolders } from '../services/arkham';
import { SearchResult } from './types';

// Binance symbol → name mapping for major coin search
const BINANCE_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP',
  ADA: 'Cardano', DOGE: 'Dogecoin', AVAX: 'Avalanche', DOT: 'Polkadot',
  LINK: 'Chainlink', UNI: 'Uniswap', NEAR: 'NEAR Protocol', APT: 'Aptos',
  ARB: 'Arbitrum', OP: 'Optimism', ATOM: 'Cosmos', LTC: 'Litecoin',
  SHIB: 'Shiba Inu', TRX: 'TRON', TON: 'Toncoin', INJ: 'Injective',
  SUI: 'Sui', PEPE: 'Pepe', WIF: 'dogwifhat', BONK: 'Bonk',
  JUP: 'Jupiter', RAY: 'Raydium', AAVE: 'Aave', MKR: 'Maker',
};

const COINGECKO_LOGOS: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  WIF: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg',
  BONK: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
};

// Search major coins via CoinGecko's free /search (geo-unblocked). Was Binance
// /ticker/24hr — a huge payload that returns HTTP 451 to US-hosted IPs
// (Vercel), so it fetched megabytes and returned [] on every query.
async function searchBinance(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const headers: Record<string, string> = process.env.COINGECKO_API_KEY
      ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
      : {};
    const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`, {
      headers,
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { coins?: Array<{ id: string; symbol: string; name: string; thumb?: string; large?: string }> };
    const coins = Array.isArray(data.coins) ? data.coins.slice(0, 6) : [];
    return coins.map((c) => {
      const sym = (c.symbol || '').toUpperCase();
      return {
        symbol: sym,
        name: c.name || sym,
        address: c.id, // CoinGecko id — chart/price routes resolve by id
        chain: 'multi',
        price: 0,
        priceUSD: 0,
        volume24h: 0,
        volumeUSD: 0,
        liquidity: 0,
        liquidityUSD: 0,
        priceChange24h: 0,
        logo: c.large || c.thumb || COINGECKO_LOGOS[sym],
        arkhamVerified: false,
        safetyScore: 8, // major indexed coins are higher trust by default
        scammerPresent: false,
        source: 'coingecko',
      };
    });
  } catch {
    return [];
  }
}

export async function universalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 1) return [];

  try {
    // Run Binance + DexScreener in parallel (primary sources — no API keys, always available)
    const [binanceResults, dexResults] = await Promise.all([
      searchBinance(query),
      searchDEXScreener(query),
    ]);

    // Merge: Binance major coins first, then DexScreener DEX tokens
    const allResults = [...binanceResults, ...dexResults];

    // Dedupe by chain:address
    const uniqueMap = new Map<string, SearchResult>();
    for (const result of allResults) {
      const key = `${result.chain}:${result.address.toLowerCase()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, result);
      } else {
        const existing = uniqueMap.get(key)!;
        if (result.volumeUSD > existing.volumeUSD) {
          uniqueMap.set(key, result);
        }
      }
    }

    let uniqueResults = Array.from(uniqueMap.values());

    // Sort: Binance major coins first (high volume, trusted), then DEX by volume
    uniqueResults.sort((a, b) => {
      const aIsBinance = (a as any).source === 'binance';
      const bIsBinance = (b as any).source === 'binance';
      if (aIsBinance && !bIsBinance) return -1;
      if (!aIsBinance && bIsBinance) return 1;
      return b.volumeUSD - a.volumeUSD;
    });

    const topResults = uniqueResults.slice(0, 20);

    // Optionally enrich with Arkham intelligence (non-blocking, won't fail search if Arkham is down)
    const enriched = await Promise.all(
      topResults.map(async (result) => {
        // Skip Arkham enrichment for Binance major coins (no contract address)
        if ((result as any).source === 'binance' || result.address.length < 10) return result;
        try {
          const holders = await getTokenHolders(result.address, 5);
          if (holders.length === 0) return result;

          const arkhamVerified = holders[0]?.entity?.verified || false;
          const scammerPresent = holders.some(h =>
            h.labels?.includes('scammer') || h.labels?.includes('rug_puller')
          );
          let safetyScore = result.safetyScore ?? 5;
          if (arkhamVerified) safetyScore = Math.min(10, safetyScore + 2);
          if (scammerPresent) safetyScore = Math.max(0, safetyScore - 3);

          return { ...result, arkhamVerified, scammerPresent, safetyScore };
        } catch {
          return result;
        }
      })
    );

    // Final sort: Arkham-verified > high safety > high volume
    enriched.sort((a, b) => {
      if (a.arkhamVerified && !b.arkhamVerified) return -1;
      if (!a.arkhamVerified && b.arkhamVerified) return 1;
      if (!a.scammerPresent && b.scammerPresent) return -1;
      if (a.scammerPresent && !b.scammerPresent) return 1;
      if (a.safetyScore !== b.safetyScore) return b.safetyScore - a.safetyScore;
      return b.volumeUSD - a.volumeUSD;
    });

    return enriched;
  } catch {
    return [];
  }
}
