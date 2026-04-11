import { NextResponse } from 'next/server';
import { scanWallet, normalizeChain, AlchemyChain } from '@/lib/alchemy';

// Binance real-time prices — no API key, always available
async function getBinancePrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  const stables = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX', 'TUSD']);
  for (const s of symbols) { if (stables.has(s)) prices[s] = 1; }
  const nonStable = symbols.filter(s => !stables.has(s));
  if (nonStable.length === 0) return prices;
  try {
    const syms = nonStable.map(s => `"${s}USDT"`).join(',');
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=[${syms}]`, { cache: 'no-store' });
    if (res.ok) {
      const data: any[] = await res.json();
      for (const item of data) {
        const sym = item.symbol?.replace('USDT', '');
        if (sym && item.price) prices[sym] = parseFloat(item.price);
      }
    }
  } catch {}
  return prices;
}

// Native token symbol per chain
const NATIVE_SYMBOLS: Record<string, string> = {
  ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH',
  polygon: 'MATIC', avalanche: 'AVAX', bnb: 'BNB',
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chainParam = searchParams.get('chain') || 'ethereum';

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Determine chain
    const chain = normalizeChain(chainParam) as AlchemyChain;
    const nativeSym = NATIVE_SYMBOLS[chain] || 'ETH';

    // Fetch native price first so we can pass it to scanWallet
    const nativePrices = await getBinancePrices([nativeSym]);
    const nativePriceUsd = nativePrices[nativeSym] || 0;

    // Scan wallet via Alchemy
    const scan = await scanWallet(address, chain, nativePriceUsd);

    // Collect all token symbols for price lookup
    const tokenSymbols = [...new Set(scan.tokens.map(t => t.symbol))];
    const allPrices = await getBinancePrices([nativeSym, ...tokenSymbols]);

    // Build portfolio array
    const portfolio = [
      {
        symbol: nativeSym,
        name: nativeSym === 'ETH' ? 'Ethereum' : nativeSym === 'MATIC' ? 'Polygon' : nativeSym === 'AVAX' ? 'Avalanche' : nativeSym,
        balance: scan.nativeBalance.toFixed(6),
        price: nativePriceUsd,
        valueUsd: scan.nativeUsd,
        change24h: 0,
        contractAddress: 'native',
        logo: null,
        isNative: true,
      },
      ...scan.tokens.map(t => {
        const price = allPrices[t.symbol] || 0;
        return {
          symbol: t.symbol,
          name: t.name,
          balance: t.balance.toFixed(6),
          price,
          valueUsd: t.balance * price,
          change24h: 0,
          contractAddress: t.address,
          logo: t.logo || null,
          isNative: false,
        };
      }),
    ];

    const totalValue = portfolio.reduce((sum, t) => sum + t.valueUsd, 0);

    return NextResponse.json({
      portfolio: portfolio.sort((a, b) => b.valueUsd - a.valueUsd),
      totalValue,
      totalChange: 0,
      tokenCount: portfolio.length,
      chain,
      txCount: scan.txCount,
      explorerUrl: scan.explorerUrl,
      recentTransactions: scan.recentTransactions.slice(0, 10),
      timestamp: new Date().toISOString(),
      priceSource: 'binance',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch portfolio' }, { status: 500 });
  }
}
