import { NextResponse } from 'next/server';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';

interface EvmChainConfig {
  rpcUrl: string;
  nativeSymbol: string;
  chainName: string;
  explorerUrl: string;
  priceId: string;
  fallbackPrice: number;
}

const EVM_CHAINS: Record<string, EvmChainConfig> = {
  ethereum: {
    rpcUrl: ALCHEMY_API_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://eth-mainnet.g.alchemy.com/v2/demo',
    nativeSymbol: 'ETH',
    chainName: 'Ethereum',
    explorerUrl: 'https://etherscan.io',
    priceId: 'ethereum',
    fallbackPrice: 3500,
  },
  base: {
    rpcUrl: ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://mainnet.base.org',
    nativeSymbol: 'ETH',
    chainName: 'Base',
    explorerUrl: 'https://basescan.org',
    priceId: 'ethereum',
    fallbackPrice: 3500,
  },
  polygon: {
    rpcUrl: ALCHEMY_API_KEY
      ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://polygon-rpc.com',
    nativeSymbol: 'MATIC',
    chainName: 'Polygon',
    explorerUrl: 'https://polygonscan.com',
    priceId: 'matic-network',
    fallbackPrice: 0.7,
  },
  avalanche: {
    rpcUrl: ALCHEMY_API_KEY
      ? `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://api.avax.network/ext/bc/C/rpc',
    nativeSymbol: 'AVAX',
    chainName: 'Avalanche',
    explorerUrl: 'https://snowtrace.io',
    priceId: 'avalanche-2',
    fallbackPrice: 35,
  },
};

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

function detectChain(address: string): 'EVM' | 'SOL' | 'UNKNOWN' {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'EVM';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'SOL';
  return 'UNKNOWN';
}

async function getEvmData(address: string, rpcUrl: string, nativeSymbol: string, chainName: string, explorerUrl: string, priceId: string, fallbackPrice: number) {
  const balanceRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest'],
    }),
  });
  const balanceData = await balanceRes.json();
  const nativeBalanceWei = parseInt(balanceData.result || '0', 16);
  const nativeBalance = nativeBalanceWei / 1e18;

  const txCountRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_getTransactionCount',
      params: [address, 'latest'],
    }),
  });
  const txCountData = await txCountRes.json();
  const txCount = parseInt(txCountData.result || '0', 16);

  let tokenBalances: any[] = [];
  const isAlchemy = rpcUrl.includes('alchemy.com');
  if (isAlchemy) {
    try {
      const tokenRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'alchemy_getTokenBalances',
          params: [address],
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.result?.tokenBalances) {
        tokenBalances = tokenData.result.tokenBalances
          .filter((t: any) => t.tokenBalance && t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000')
          .slice(0, 20);
      }
    } catch (e) {
      console.error('Token balance fetch error:', e);
    }
  }

  let tokenDetails: any[] = [];
  if (tokenBalances.length > 0 && isAlchemy) {
    const metadataPromises = tokenBalances.slice(0, 10).map(async (token: any) => {
      try {
        const metaRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 4,
            method: 'alchemy_getTokenMetadata',
            params: [token.contractAddress],
          }),
        });
        const metaData = await metaRes.json();
        const decimals = metaData.result?.decimals || 18;
        const rawBalance = BigInt(token.tokenBalance);
        const balance = Number(rawBalance) / Math.pow(10, decimals);
        return {
          contractAddress: token.contractAddress,
          symbol: metaData.result?.symbol || 'UNKNOWN',
          name: metaData.result?.name || 'Unknown Token',
          decimals,
          balance: balance,
          logo: metaData.result?.logo || null,
        };
      } catch {
        return null;
      }
    });
    const results = await Promise.all(metadataPromises);
    tokenDetails = results.filter((t) => t !== null && t.balance > 0);
  }

  let nativePrice = 0;
  try {
    const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${priceId}&vs_currencies=usd`, {
      headers: { 'Accept': 'application/json' },
    });
    const priceData = await priceRes.json();
    nativePrice = priceData[priceId]?.usd || 0;
  } catch {
    nativePrice = fallbackPrice;
  }

  const nativeValueUsd = nativeBalance * nativePrice;

  const holdings = [
    {
      symbol: nativeSymbol,
      name: chainName,
      balance: nativeBalance.toFixed(4),
      valueUsd: nativeValueUsd.toFixed(2),
      contractAddress: null,
    },
    ...tokenDetails.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      balance: t.balance > 1000 ? t.balance.toFixed(0) : t.balance.toFixed(4),
      valueUsd: null,
      contractAddress: t.contractAddress,
    })),
  ];

  return {
    chain: chainName,
    address,
    nativeBalance: nativeBalance.toFixed(4),
    nativeValueUsd: nativeValueUsd.toFixed(2),
    totalBalanceUsd: nativeValueUsd.toFixed(2),
    txCount,
    holdings,
    tokenCount: tokenDetails.length,
    explorerUrl,
    ethBalance: nativeSymbol === 'ETH' ? nativeBalance.toFixed(4) : undefined,
    ethValueUsd: nativeSymbol === 'ETH' ? nativeValueUsd.toFixed(2) : undefined,
  };
}

async function getSolData(address: string) {
  const balanceRes = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    }),
  });
  const balanceData = await balanceRes.json();
  const solBalance = (balanceData.result?.value || 0) / 1e9;

  let txCount = 0;
  try {
    const sigRes = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 1000 }],
      }),
    });
    const sigData = await sigRes.json();
    txCount = sigData.result?.length || 0;
  } catch {
    txCount = 0;
  }

  let solPrice = 0;
  try {
    const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      headers: { 'Accept': 'application/json' },
    });
    const priceData = await priceRes.json();
    solPrice = priceData.solana?.usd || 0;
  } catch {
    solPrice = 170;
  }

  const solValueUsd = solBalance * solPrice;

  return {
    chain: 'Solana',
    address,
    solBalance: solBalance.toFixed(4),
    solValueUsd: solValueUsd.toFixed(2),
    totalBalanceUsd: solValueUsd.toFixed(2),
    txCount,
    holdings: [
      {
        symbol: 'SOL',
        name: 'Solana',
        balance: solBalance.toFixed(4),
        valueUsd: solValueUsd.toFixed(2),
        contractAddress: null,
      },
    ],
    tokenCount: 0,
    explorerUrl: 'https://solscan.io',
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chainParam = searchParams.get('chain') || 'auto';

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const detectedType = detectChain(address);

    if (detectedType === 'UNKNOWN') {
      return NextResponse.json({ error: 'Invalid wallet address. Supports EVM (0x...) and SOL (base58) addresses.' }, { status: 400 });
    }

    let walletData;
    if (detectedType === 'SOL') {
      walletData = await getSolData(address);
    } else {
      const evmChainKey = chainParam !== 'auto' && EVM_CHAINS[chainParam] ? chainParam : 'ethereum';
      const config = EVM_CHAINS[evmChainKey];
      walletData = await getEvmData(
        address,
        config.rpcUrl,
        config.nativeSymbol,
        config.chainName,
        config.explorerUrl,
        config.priceId,
        config.fallbackPrice
      );
    }

    return NextResponse.json(walletData, {
      headers: {
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (error: any) {
    console.error('Wallet intelligence error:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze wallet' }, { status: 500 });
  }
}
