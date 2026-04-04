export interface PriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  lastUpdate: Date;
}

export async function getRealTimePrice(address: string, chain: string = 'solana'): Promise<PriceData> {
  try {
    if (chain === 'solana') {
      const jupiterPrice = await fetchFromJupiter(address);
      if (jupiterPrice) return jupiterPrice;
    }

    const dexPrice = await fetchPriceFromDEXScreener(address);
    if (dexPrice) return dexPrice;

    const cgPrice = await fetchPriceFromCoinGecko(address, chain);
    if (cgPrice) return cgPrice;

    return { price: 0, priceChange24h: 0, volume24h: 0, lastUpdate: new Date() };
  } catch {
    return { price: 0, priceChange24h: 0, volume24h: 0, lastUpdate: new Date() };
  }
}

async function fetchFromJupiter(address: string): Promise<PriceData | null> {
  try {
    const res = await fetch(`https://price.jup.ag/v4/price?ids=${address}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    const d = data.data?.[address];
    if (!d) return null;
    return { price: d.price, priceChange24h: 0, volume24h: 0, lastUpdate: new Date() };
  } catch {
    return null;
  }
}

async function fetchPriceFromDEXScreener(address: string): Promise<PriceData | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    const pairs = data.pairs || [];
    if (!pairs.length) return null;
    const best = pairs.reduce((a: any, b: any) => parseFloat(a.liquidity?.usd || '0') > parseFloat(b.liquidity?.usd || '0') ? a : b);
    return {
      price: parseFloat(best.priceUsd || '0'),
      priceChange24h: parseFloat(best.priceChange?.h24 || '0'),
      volume24h: parseFloat(best.volume?.h24 || '0'),
      lastUpdate: new Date(),
    };
  } catch {
    return null;
  }
}

async function fetchPriceFromCoinGecko(address: string, chain: string): Promise<PriceData | null> {
  try {
    const platformMap: Record<string, string> = {
      solana: 'solana',
      ethereum: 'ethereum',
      polygon: 'polygon-pos',
      arbitrum: 'arbitrum-one',
      base: 'base',
    };
    const platform = platformMap[chain];
    if (!platform) return null;

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${address}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const d = data[address.toLowerCase()];
    if (!d) return null;
    return {
      price: d.usd || 0,
      priceChange24h: d.usd_24h_change || 0,
      volume24h: d.usd_24h_vol || 0,
      lastUpdate: new Date(),
    };
  } catch {
    return null;
  }
}
