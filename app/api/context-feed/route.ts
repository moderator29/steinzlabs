import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const events = [
      {
        id: '1', type: 'whale_transfer', sentiment: 'BULLISH',
        title: 'Large SOL to USDC swap detected',
        summary: 'Whale wallet 0x742d...3a7f swapped 25,000 SOL ($4.46M) for USDC on Jupiter. Wallet has 87% historical accuracy on market timing.',
        from: '0x742d4Dc64C3647c5c5A20e1A2A0B3c8d91D3a7f', to: '0xJupiterProtocolAddress',
        value: 25000, valueUsd: 4460000, chain: 'Solana', trustScore: 82,
        txHash: '0x7f8c9a1b2e3d4f5a6b7c8d9e0f1a2b3c4d5e6f7a', blockNumber: 248912445,
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      },
      {
        id: '2', type: 'token_launch', sentiment: 'HYPE',
        title: 'New memecoin $FIZZ launched on Pump.fun',
        summary: 'Token raised 16,000 SOL in first hour. Top investor wallet linked to 3 previous 100x launches.',
        from: '0x9f3a4Bc72D1e5F6a7B8c9D0e1F2a3B4c5D6e7F8a', to: '0xPumpFunContractAddress',
        value: 16000, valueUsd: 2800000, chain: 'Solana', trustScore: 45,
        txHash: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0', blockNumber: 248912400,
        timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
      },
      {
        id: '3', type: 'liquidity_removal', sentiment: 'BEARISH',
        title: 'Massive ETH liquidity removal on Uniswap',
        summary: 'Developer wallet removed $1.2M liquidity from PEPE/ETH pool. Wallet previously associated with 2 rug pulls.',
        from: '0x3e7b8Fc42D1a5E6b7C8d9E0f1A2b3C4d5E6f7F8a', to: '0xUniswapV3PoolAddress',
        value: 450, valueUsd: 1200000, chain: 'Ethereum', trustScore: 18,
        txHash: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1', blockNumber: 19451823,
        timestamp: new Date(Date.now() - 23 * 60000).toISOString(),
      },
      {
        id: '4', type: 'smart_money', sentiment: 'BULLISH',
        title: 'Smart money accumulating LINK',
        summary: '14 wallets with >80% win rate bought LINK in the last 2 hours. Combined position: $8.2M.',
        from: '0x5a6b7C8d9E0f1A2b3C4d5E6f7A8b9C0d1E2f3A4b', to: '0xChainlinkTokenAddress',
        value: 3200, valueUsd: 8200000, chain: 'Ethereum', trustScore: 91,
        txHash: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2', blockNumber: 19451800,
        timestamp: new Date(Date.now() - 34 * 60000).toISOString(),
      },
      {
        id: '5', type: 'whale_transfer', sentiment: 'BULLISH',
        title: 'BlackRock ETF wallet moves 5,000 BTC',
        summary: 'Institutional wallet associated with BlackRock iShares moved 5,000 BTC ($485M) to cold storage. Accumulation signal.',
        from: '0xBlackRockCustodyWallet', to: '0xColdStorageAddress',
        value: 5000, valueUsd: 485000000, chain: 'Bitcoin', trustScore: 95,
        txHash: '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3', blockNumber: 830245,
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      },
    ];

    return NextResponse.json({ events: events.slice(0, limit), total: events.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Context feed error:', error);
    return NextResponse.json({ error: 'Failed to fetch context feed' }, { status: 500 });
  }
}
