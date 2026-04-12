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

// Search Binance for major coin matches
async function searchBinance(query: string): Promise<SearchResult[]> {
  const q = query.toUpperCase().trim();
  try {
    // Fetch all Binance USDT tickers once, filter by query match
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', { cache: 'no-store' });
    if (!res.ok) return [];
    const tickers: any[] = await res.json();
    const matches = tickers
      .filter((t: any) => {
        if (!t.symbol.endsWith('USDT')) return false;
        const sym = t.symbol.replace('USDT', '');
        const name = (BINANCE_NAMES[sym] || '').toUpperCase();
        return sym.includes(q) || name.includes(q);
      })
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 5);

    return matches.map((t: any) => {
      const sym = t.symbol.replace('USDT', '');
      return {
        symbol: sym,
        name: BINANCE_NAMES[sym] || sym,
        address: sym.toLowerCase(),
        chain: 'multi',
        price: parseFloat(t.lastPrice) || 0,
        priceUSD: parseFloat(t.lastPrice) || 0,
        volume24h: parseFloat(t.quoteVolume) || 0,
        volumeUSD: parseFloat(t.quoteVolume) || 0,
        liquidity: 0,
        liquidityUSD: 0,
        priceChange24h: parseFloat(t.priceChangePercent) || 0,
        logo: COINGECKO_LOGOS[sym],
        arkhamVerified: false,
        safetyScore: 8, // major listed coins are higher trust by default
        scammerPresent: false,
        source: 'binance',
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
