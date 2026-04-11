import { NextResponse } from 'next/server';

const COINGECKO_KEY = process.env.COINGECKO_API_KEY;
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;

async function getTokenPrices() {
  try {
    const headers: Record<string, string> = {};
    if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,solana,chainlink,uniswap,aave,polygon-ecosystem-token,arbitrum&vs_currencies=usd&include_24hr_change=true&include_market_cap=true',
      { headers, next: { revalidate: 30 } }
    );
    return await res.json();
  } catch {
    return {};
  }
}

async function getWalletBalances(address: string) {
  if (!ALCHEMY_KEY) return [];

  try {
    const ethRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_getBalance',
        params: [address, 'latest']
      }),
    });
    const ethData = await ethRes.json();
    const ethBalance = parseInt(ethData.result, 16) / 1e18;

    const tokenRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'alchemy_getTokenBalances',
        params: [address, 'DEFAULT_TOKENS']
      }),
    });
    const tokenData = await tokenRes.json();
    const tokenBalances = tokenData.result?.tokenBalances || [];

    const nonZeroTokens = tokenBalances
      .filter((t: any) => t.tokenBalance && t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000')
      .slice(0, 20);

    let tokenDetails: any[] = [];
    if (nonZeroTokens.length > 0) {
      const metaPromises = nonZeroTokens.map((t: any) =>
        fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 3, method: 'alchemy_getTokenMetadata',
            params: [t.contractAddress]
          }),
        }).then(r => r.json()).catch(() => null)
      );

      const metaResults = await Promise.all(metaPromises);
      tokenDetails = nonZeroTokens.map((t: any, i: number) => {
        const meta = metaResults[i]?.result;
        const decimals = meta?.decimals || 18;
        const rawBalance = parseInt(t.tokenBalance, 16);
        const balance = rawBalance / Math.pow(10, decimals);
        return {
          contractAddress: t.contractAddress,
          symbol: meta?.symbol || 'UNKNOWN',
          name: meta?.name || 'Unknown Token',
          balance: balance.toString(),
          decimals,
        };
      }).filter((t: any) => parseFloat(t.balance) > 0);
    }

    return [
      { symbol: 'ETH', name: 'Ethereum', balance: ethBalance.toString(), contractAddress: 'native' },
      ...tokenDetails
    ];
  } catch (error) {

    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const [balances, prices] = await Promise.all([
      getWalletBalances(address),
      getTokenPrices(),
    ]);

    const ethPrice = prices?.ethereum?.usd || 3500;
    const ethChange = prices?.ethereum?.usd_24h_change || 0;

    const portfolio = balances.map((token: any) => {
      let price = 0;
      let change24h = 0;

      if (token.symbol === 'ETH') {
        price = ethPrice;
        change24h = ethChange;
      } else if (token.symbol === 'WETH') {
        price = ethPrice;
        change24h = ethChange;
      }

      const balance = parseFloat(token.balance) || 0;
      const valueUsd = balance * price;

      return {
        symbol: token.symbol,
        name: token.name,
        balance: token.balance,
        price,
        valueUsd,
        change24h,
        contractAddress: token.contractAddress,
      };
    });

    const totalValue = portfolio.reduce((sum: number, t: any) => sum + t.valueUsd, 0);
    const totalChange = totalValue > 0
      ? portfolio.reduce((sum: number, t: any) => sum + (t.valueUsd * t.change24h / 100), 0) / totalValue * 100
      : 0;

    return NextResponse.json({
      portfolio: portfolio.sort((a: any, b: any) => b.valueUsd - a.valueUsd),
      totalValue,
      totalChange,
      tokenCount: portfolio.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {

    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}
