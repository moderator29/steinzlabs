import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=24h',
      {
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || ''
        },
        next: { revalidate: 60 }
      }
    );

    if (!response.ok) {
      throw new Error('CoinGecko API failed');
    }

    const coins = await response.json();

    if (!Array.isArray(coins)) {
      throw new Error('Invalid response format');
    }

    const prices = coins.reduce((acc: any, coin: any) => {
      acc[coin.symbol.toUpperCase()] = {
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h || 0,
        name: coin.name,
        image: coin.image,
        marketCap: coin.market_cap,
        volume: coin.total_volume
      };
      return acc;
    }, {});

    return NextResponse.json(prices);

  } catch (error) {
    console.error('Price fetch error:', error);
    return NextResponse.json({
      BTC: { price: 97250, change24h: 2.14, name: 'Bitcoin' },
      ETH: { price: 3450, change24h: 1.87, name: 'Ethereum' },
      SOL: { price: 178, change24h: 4.32, name: 'Solana' },
      BNB: { price: 620, change24h: 1.23, name: 'BNB' },
      XRP: { price: 2.45, change24h: -0.82, name: 'XRP' },
      ADA: { price: 0.72, change24h: 3.15, name: 'Cardano' },
      DOGE: { price: 0.32, change24h: 5.67, name: 'Dogecoin' },
      AVAX: { price: 38.50, change24h: -1.45, name: 'Avalanche' },
      DOT: { price: 7.85, change24h: 2.31, name: 'Polkadot' },
      LINK: { price: 18.20, change24h: 4.12, name: 'Chainlink' },
    });
  }
}
