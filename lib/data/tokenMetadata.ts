export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  chain: string;
}

const metadataCache = new Map<string, { data: TokenMetadata; expires: number }>();

export async function getTokenMetadata(address: string, chain: string = 'solana'): Promise<TokenMetadata> {
  const cacheKey = `${chain}:${address}`;
  const cached = metadataCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const dexData = await fetchFromDEXScreener(address, chain);
    if (dexData) return cacheAndReturn(cacheKey, dexData);

    const cgData = await fetchFromCoinGecko(address, chain);
    if (cgData) return cacheAndReturn(cacheKey, cgData);

    return cacheAndReturn(cacheKey, createFallback(address, chain));
  } catch (error) {

    return createFallback(address, chain);
  }
}

async function fetchFromCoinGecko(address: string, chain: string): Promise<TokenMetadata | null> {
  try {
    const platformMap: Record<string, string> = {
      solana: 'solana',
      ethereum: 'ethereum',
      polygon: 'polygon-pos',
      arbitrum: 'arbitrum-one',
      optimism: 'optimistic-ethereum',
      base: 'base',
      bsc: 'binance-smart-chain',
    };
    const platform = platformMap[chain];
    if (!platform) return null;

    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${platform}/contract/${address}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      address,
      symbol: d.symbol?.toUpperCase() || 'UNKNOWN',
      name: d.name || 'Unknown',
      logo: d.image?.large || d.image?.small || null,
      decimals: d.detail_platforms?.[platform]?.decimal_place || 18,
      price: d.market_data?.current_price?.usd || 0,
      priceChange24h: d.market_data?.price_change_percentage_24h || 0,
      volume24h: d.market_data?.total_volume?.usd || 0,
      marketCap: d.market_data?.market_cap?.usd || 0,
      chain,
    };
  } catch {
    return null;
  }
}

async function fetchFromDEXScreener(address: string, chain: string): Promise<TokenMetadata | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const pairs = data.pairs || [];
    if (!pairs.length) return null;
    const best = pairs.reduce((a: any, b: any) => parseFloat(a.liquidity?.usd || '0') > parseFloat(b.liquidity?.usd || '0') ? a : b);
    const token = best.baseToken;
    return {
      address,
      symbol: token.symbol || 'UNKNOWN',
      name: token.name || 'Unknown',
      logo: best.info?.imageUrl || null,
      decimals: 9,
      price: parseFloat(best.priceUsd || '0'),
      priceChange24h: parseFloat(best.priceChange?.h24 || '0'),
      volume24h: parseFloat(best.volume?.h24 || '0'),
      marketCap: parseFloat(best.marketCap || '0'),
      chain: best.chainId || chain,
    };
  } catch {
    return null;
  }
}

function cacheAndReturn(key: string, data: TokenMetadata): TokenMetadata {
  metadataCache.set(key, { data, expires: Date.now() + 3600000 });
  return data;
}

function createFallback(address: string, chain: string): TokenMetadata {
  return {
    address,
    symbol: address.slice(0, 6).toUpperCase(),
    name: `Token ${address.slice(0, 8)}`,
    logo: null,
    decimals: chain === 'solana' ? 9 : 18,
    price: 0,
    priceChange24h: 0,
    volume24h: 0,
    marketCap: 0,
    chain,
  };
}

export async function batchGetTokenMetadata(tokens: Array<{ address: string; chain: string }>): Promise<Map<string, TokenMetadata>> {
  const results = new Map<string, TokenMetadata>();
  const batchSize = 10;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    await Promise.all(batch.map(async (t) => {
      const meta = await getTokenMetadata(t.address, t.chain);
      results.set(t.address, meta);
    }));
    if (i + batchSize < tokens.length) await new Promise(r => setTimeout(r, 200));
  }
  return results;
}
