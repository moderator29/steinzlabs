import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

interface ExchangeConfig {
  name: string;
  id: string;
  baseUrl: string;
  type: 'cex' | 'dex';
  chains: string[];
  features: string[];
}

const SUPPORTED_EXCHANGES: ExchangeConfig[] = [
  { name: 'Binance', id: 'binance', baseUrl: 'https://api.binance.com', type: 'cex', chains: ['ETH', 'BSC', 'SOL', 'MATIC'], features: ['spot', 'futures', 'margin'] },
  { name: 'Coinbase', id: 'coinbase', baseUrl: 'https://api.coinbase.com', type: 'cex', chains: ['ETH', 'SOL', 'MATIC', 'AVAX'], features: ['spot'] },
  { name: 'Kraken', id: 'kraken', baseUrl: 'https://api.kraken.com', type: 'cex', chains: ['ETH', 'SOL'], features: ['spot', 'futures', 'margin'] },
  { name: 'OKX', id: 'okx', baseUrl: 'https://www.okx.com/api', type: 'cex', chains: ['ETH', 'BSC', 'SOL', 'MATIC', 'AVAX', 'ARB'], features: ['spot', 'futures', 'margin', 'options'] },
  { name: 'Bybit', id: 'bybit', baseUrl: 'https://api.bybit.com', type: 'cex', chains: ['ETH', 'SOL', 'ARB'], features: ['spot', 'futures', 'margin'] },
  { name: 'Jupiter', id: 'jupiter', baseUrl: 'https://quote-api.jup.ag', type: 'dex', chains: ['SOL'], features: ['swap', 'limit', 'dca'] },
  { name: 'Uniswap', id: 'uniswap', baseUrl: 'https://api.uniswap.org', type: 'dex', chains: ['ETH', 'MATIC', 'ARB', 'BASE'], features: ['swap'] },
  { name: '1inch', id: '1inch', baseUrl: 'https://api.1inch.dev', type: 'dex', chains: ['ETH', 'BSC', 'MATIC', 'ARB', 'AVAX', 'BASE'], features: ['swap', 'limit', 'fusion'] },
  { name: 'Raydium', id: 'raydium', baseUrl: 'https://api.raydium.io', type: 'dex', chains: ['SOL'], features: ['swap', 'liquidity', 'farming'] },
  { name: 'PancakeSwap', id: 'pancakeswap', baseUrl: 'https://pancakeswap.finance/api', type: 'dex', chains: ['BSC', 'ETH'], features: ['swap', 'liquidity', 'farming'] },
];

async function fetchBinanceTicker(symbol: string) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`, { next: { revalidate: 10 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchMultipleTickers() {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ARBUSDT', 'LINKUSDT', 'UNIUSDT', 'AAVEUSDT'];
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`, { next: { revalidate: 10 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const exchange = searchParams.get('exchange');
  const symbol = searchParams.get('symbol');

  if (action === 'list') {
    return NextResponse.json({ exchanges: SUPPORTED_EXCHANGES });
  }

  if (action === 'ticker' && symbol) {
    const ticker = await fetchBinanceTicker(symbol.toUpperCase());
    if (ticker) {
      return NextResponse.json({
        symbol: ticker.symbol,
        price: parseFloat(ticker.lastPrice),
        change24h: parseFloat(ticker.priceChangePercent),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        volume24h: parseFloat(ticker.volume),
        quoteVolume24h: parseFloat(ticker.quoteVolume),
      });
    }
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
  }

  if (action === 'tickers') {
    const tickers = await fetchMultipleTickers();
    const formatted = tickers.map((t: any) => ({
      symbol: t.symbol?.replace('USDT', ''),
      pair: t.symbol,
      price: parseFloat(t.lastPrice || '0'),
      change24h: parseFloat(t.priceChangePercent || '0'),
      volume24h: parseFloat(t.quoteVolume || '0'),
    }));
    return NextResponse.json({ tickers: formatted });
  }

  if (action === 'status') {
    const statuses = await Promise.all(
      SUPPORTED_EXCHANGES.filter(e => e.type === 'cex').slice(0, 3).map(async (ex) => {
        try {
          const start = Date.now();
          const res = await fetch(`${ex.baseUrl}/api/v3/ping`, { signal: AbortSignal.timeout(3000) });
          const latency = Date.now() - start;
          return { exchange: ex.name, id: ex.id, status: res.ok ? 'online' : 'degraded', latency };
        } catch {
          return { exchange: ex.name, id: ex.id, status: 'offline', latency: null };
        }
      })
    );
    return NextResponse.json({ statuses });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
