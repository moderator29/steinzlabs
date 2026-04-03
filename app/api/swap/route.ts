import { NextRequest, NextResponse } from 'next/server';

const COMMON_TOKENS: Record<string, Record<string, string>> = {
  ethereum: {
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    MKR: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    CRV: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
  },
  solana: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  },
  base: {
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  polygon: {
    MATIC: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  bsc: {
    BNB: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
  },
  avalanche: {
    AVAX: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  },
  arbitrum: {
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  },
};

const MOCK_PRICES: Record<string, number> = {
  ETH: 3450, SOL: 178, BNB: 620, MATIC: 0.72, AVAX: 38,
  WBTC: 65200, USDC: 1, USDT: 1, DAI: 1, LINK: 14.5,
  UNI: 7.2, ARB: 1.15, OP: 2.1, AAVE: 95, MKR: 1580,
  CRV: 0.52, PEPE: 0.0000085, WIF: 2.4, BONK: 0.000023,
  JUP: 0.85, RAY: 1.92,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromToken = searchParams.get('from') || 'ETH';
  const toToken = searchParams.get('to') || 'USDC';
  const amount = searchParams.get('amount') || '0';
  const chain = searchParams.get('chain') || 'ethereum';
  const slippage = parseFloat(searchParams.get('slippage') || '0.5');

  const fromPrice = MOCK_PRICES[fromToken] || 1;
  const toPrice = MOCK_PRICES[toToken] || 1;

  const amountNum = parseFloat(amount);
  if (!amountNum || amountNum <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const fromUsd = amountNum * fromPrice;
  const toAmount = fromUsd / toPrice;
  const priceImpact = amountNum > 1000 ? 0.15 : amountNum > 100 ? 0.05 : 0.01;
  const minReceived = toAmount * (1 - slippage / 100);

  const gasEstimate = chain === 'solana' ? 0.001 : chain === 'base' ? 0.02 : chain === 'polygon' ? 0.01 : chain === 'bsc' ? 0.10 : chain === 'avalanche' ? 0.05 : chain === 'arbitrum' ? 0.15 : 2.40;

  const fromAddress = COMMON_TOKENS[chain]?.[fromToken] || '0x0';
  const toAddress = COMMON_TOKENS[chain]?.[toToken] || '0x0';

  const dexName = chain === 'solana' ? 'Raydium' : chain === 'bsc' ? 'PancakeSwap' : chain === 'polygon' ? 'QuickSwap' : chain === 'avalanche' ? 'TraderJoe' : chain === 'arbitrum' ? 'Camelot' : chain === 'base' ? 'Aerodrome' : 'Uniswap V3';

  return NextResponse.json({
    fromToken,
    toToken,
    fromAmount: amountNum,
    toAmount: parseFloat(toAmount.toFixed(toPrice >= 1 ? 6 : 10)),
    fromAmountUsd: fromUsd,
    toAmountUsd: toAmount * toPrice,
    rate: fromPrice / toPrice,
    priceImpact,
    minReceived: parseFloat(minReceived.toFixed(6)),
    slippage,
    gasEstimateUsd: gasEstimate,
    route: {
      dex: dexName,
      chain,
      fromAddress,
      toAddress,
      hops: 1,
    },
    validUntil: Date.now() + 30000,
  });
}
