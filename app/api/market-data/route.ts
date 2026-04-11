import { NextResponse } from 'next/server';

// Static logo map — no API key needed
const LOGOS: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  TRX: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  DOT: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  LTC: 'https://assets.coingecko.com/coins/images/2/small/litecoin.png',
  NEAR: 'https://assets.coingecko.com/coins/images/10365/small/near.jpg',
  APT: 'https://assets.coingecko.com/coins/images/26455/small/aptos_round.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  OP: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  ATOM: 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  WIF: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg',
  BONK: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
  SUI: 'https://assets.coingecko.com/coins/images/26375/small/sui-ocean-square.png',
  TON: 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',
};

const NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', XRP: 'XRP', SOL: 'Solana',
  USDT: 'Tether', USDC: 'USD Coin', ADA: 'Cardano', DOGE: 'Dogecoin', TRX: 'TRON',
  TON: 'Toncoin', AVAX: 'Avalanche', MATIC: 'Polygon', LINK: 'Chainlink',
  DOT: 'Polkadot', SHIB: 'Shiba Inu', UNI: 'Uniswap', LTC: 'Litecoin',
  NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
  ATOM: 'Cosmos', PEPE: 'Pepe', WIF: 'dogwifhat', BONK: 'Bonk', SUI: 'Sui',
};

// Simple in-memory cache
let cachedTokens: any[] | null = null;
let cacheTs = 0;
const CACHE_TTL = 30_000;

async function fetchFromBinance(limit: number): Promise<any[]> {
  const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const tickers: any[] = await res.json();

  return tickers
    .filter((t: any) => t.symbol.endsWith('USDT'))
    .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, limit)
    .map((t: any, i: number) => {
      const sym = t.symbol.replace('USDT', '');
      return {
        id: sym.toLowerCase(),
        symbol: sym,
        name: NAMES[sym] || sym,
        price: parseFloat(t.lastPrice) || 0,
        change24h: parseFloat(t.priceChangePercent) || 0,
        change7d: 0,
        volume24h: parseFloat(t.quoteVolume) || 0,
        marketCap: 0,
        rank: i + 1,
        sparkline: [],
        image: LOGOS[sym] || `https://ui-avatars.com/api/?name=${encodeURIComponent(sym)}&background=0A1EFF&color=fff&size=64&bold=true&rounded=true`,
        source: 'binance',
      };
    });
}

async function enrichWithCoinGecko(tokens: any[]): Promise<any[]> {
  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&sparkline=false',
      {
        headers: process.env.COINGECKO_API_KEY
          ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
          : {},
        next: { revalidate: 60 },
      }
    );
    if (!cgRes.ok) return tokens;
    const coins: any[] = await cgRes.json();
    for (const c of coins) {
      const t = tokens.find(x => x.symbol === c.symbol.toUpperCase());
      if (t) {
        t.marketCap = c.market_cap ?? 0;
        t.name = c.name;
        t.image = c.image || t.image;
        t.id = c.id;
      }
    }
  } catch { /* non-fatal */ }
  return tokens;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'top';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 250);

    // Serve from cache if fresh
    if (cachedTokens && Date.now() - cacheTs < CACHE_TTL) {
      let tokens = cachedTokens;
      if (category === 'gainers') tokens = [...tokens].sort((a, b) => b.change24h - a.change24h).slice(0, limit);
      else if (category === 'losers') tokens = [...tokens].sort((a, b) => a.change24h - b.change24h).slice(0, limit);
      else tokens = tokens.slice(0, limit);
      return NextResponse.json({ tokens, category, total: tokens.length, timestamp: new Date().toISOString() });
    }

    // Primary: Binance (always works, no API key)
    let tokens = await fetchFromBinance(100);
    // Enrich with CoinGecko market caps (best-effort, non-blocking failure)
    tokens = await enrichWithCoinGecko(tokens);

    cachedTokens = tokens;
    cacheTs = Date.now();

    if (category === 'gainers') tokens = [...tokens].sort((a, b) => b.change24h - a.change24h).slice(0, limit);
    else if (category === 'losers') tokens = [...tokens].sort((a, b) => a.change24h - b.change24h).slice(0, limit);
    else tokens = tokens.slice(0, limit);

    return NextResponse.json({
      tokens,
      category,
      total: tokens.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ tokens: [], category: 'top', total: 0, timestamp: new Date().toISOString() });
  }
}
