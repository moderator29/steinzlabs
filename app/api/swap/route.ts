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

const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', MATIC: 'matic-network',
  AVAX: 'avalanche-2', WBTC: 'wrapped-bitcoin', USDC: 'usd-coin', USDT: 'tether',
  DAI: 'dai', LINK: 'chainlink', UNI: 'uniswap', ARB: 'arbitrum',
  OP: 'optimism', AAVE: 'aave', MKR: 'maker', CRV: 'curve-dao-token',
  PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk', JUP: 'jupiter-exchange-solana',
  RAY: 'raydium', NAKA: 'nakamoto-games', DOGE: 'dogecoin', SHIB: 'shiba-inu',
  XRP: 'ripple', ADA: 'cardano',
};

// Stablecoins only — always $1, never stale
const STABLECOIN_PRICES: Record<string, number> = {
  USDC: 1, USDT: 1, DAI: 1, BUSD: 1, TUSD: 1, FRAX: 1,
};

// Chain ID mapping for EVM chains
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  polygon: 137,
  bsc: 56,
  avalanche: 43114,
  arbitrum: 42161,
};

let priceCache: { prices: Record<string, number>; ts: number } = { prices: {}, ts: 0 };
const CACHE_TTL = 30000;

async function fetchLivePrices(tokens: string[]): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - priceCache.ts < CACHE_TTL && tokens.every(t => priceCache.prices[t] !== undefined)) {
    return priceCache.prices;
  }

  const prices: Record<string, number> = { ...priceCache.prices };

  // PRIMARY: Binance — real-time, free, no key needed
  const nonStable = tokens.filter(t => !STABLECOIN_PRICES[t]);
  if (nonStable.length > 0) {
    try {
      const syms = nonStable.map(t => `"${t}USDT"`);
      const url = `https://api.binance.com/api/v3/ticker/price?symbols=[${syms.join(',')}]`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data: any[] = await res.json();
        for (const item of data) {
          const sym = item.symbol?.replace('USDT', '');
          if (sym && item.price) prices[sym] = parseFloat(item.price);
        }
      }
    } catch {}
  }

  // FALLBACK: DexScreener for tokens not found on Binance
  const missing = tokens.filter(t => !prices[t] && !STABLECOIN_PRICES[t]);
  for (const token of missing) {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const best = (data.pairs || []).sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        if (best?.priceUsd) prices[token] = parseFloat(best.priceUsd);
      }
    } catch {}
  }

  priceCache = { prices, ts: now };
  return prices;
}

// Alchemy gas price for EVM chains
async function fetchAlchemyGasPrice(chain: string): Promise<number> {
  const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || '';
  if (!ALCHEMY_KEY || chain === 'solana') return 0;
  const RPC_URLS: Record<string, string> = {
    ethereum: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    base:     `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    polygon:  `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    optimism: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    avalanche:`https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    bnb:      `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  };
  const url = RPC_URLS[chain];
  if (!url) return 0;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
      cache: 'no-store',
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const gasPriceGwei = parseInt(data.result || '0x0', 16) / 1e9;
    // Estimate gas cost for a swap (~200k gas) in USD
    // Use ETH/AVAX/MATIC price as denominator
    const nativePrices: Record<string, string> = { ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH', polygon: 'MATIC', avalanche: 'AVAX', bnb: 'BNB' };
    const nativeSym = nativePrices[chain] || 'ETH';
    const nativePrice = priceCache.prices[nativeSym] || 0;
    const gasCostEth = (gasPriceGwei * 1e9 * 200000) / 1e18;
    return gasCostEth * nativePrice;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromToken = searchParams.get('from') || 'ETH';
  const toToken = searchParams.get('to') || 'USDC';
  const amount = searchParams.get('amount') || '0';
  const chain = searchParams.get('chain') || 'ethereum';
  const slippage = parseFloat(searchParams.get('slippage') || '0.5');

  const amountNum = parseFloat(amount);
  if (!amountNum || amountNum <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  let livePrices: Record<string, number> = {};
  try {
    livePrices = await fetchLivePrices([fromToken, toToken]);
  } catch {}

  // For tokens not found via CoinGecko, try on-chain price search
  for (const token of [fromToken, toToken]) {
    if (!livePrices[token] && !STABLECOIN_PRICES[token]) {
      try {
        const dexRes = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(token.toLowerCase())}&vs_currencies=usd`,
          { next: { revalidate: 60 } }
        );
        if (dexRes.ok) {
          const data = await dexRes.json();
          const price = Object.values(data)[0] as any;
          if (price?.usd) livePrices[token] = price.usd;
        }
      } catch {}
    }
  }

  const fromPrice = livePrices[fromToken] ?? STABLECOIN_PRICES[fromToken];
  const toPrice = livePrices[toToken] ?? STABLECOIN_PRICES[toToken];

  if (!fromPrice || !toPrice) {
    return NextResponse.json(
      { error: `Live price unavailable for ${!fromPrice ? fromToken : toToken}. Try again.` },
      { status: 503 }
    );
  }

  const fromUsd = amountNum * fromPrice;

  // ── STEINZ Platform Fee (0.1%) ─────────────────────────────────────────────
  const PLATFORM_FEE_RATE = 0.001; // 0.1%
  const platformFeeUsd = fromUsd * PLATFORM_FEE_RATE;
  const amountAfterFee = fromUsd - platformFeeUsd;

  const toAmount = amountAfterFee / toPrice;
  const priceImpact = amountNum > 1000 ? 0.15 : amountNum > 100 ? 0.05 : 0.01;
  const minReceived = toAmount * (1 - slippage / 100);

  const gasEstimate = chain === 'solana' ? 0.001 : chain === 'base' ? 0.02 : chain === 'polygon' ? 0.01 : chain === 'bsc' ? 0.10 : chain === 'avalanche' ? 0.05 : chain === 'arbitrum' ? 0.15 : 2.40;

  const fromAddress = COMMON_TOKENS[chain]?.[fromToken] || '0x0';
  const toAddress = COMMON_TOKENS[chain]?.[toToken] || '0x0';

  const dexName = chain === 'solana' ? 'Raydium' : chain === 'bsc' ? 'PancakeSwap' : chain === 'polygon' ? 'QuickSwap' : chain === 'avalanche' ? 'TraderJoe' : chain === 'arbitrum' ? 'Camelot' : chain === 'base' ? 'Aerodrome' : 'Uniswap V3';

  // Treasury wallets — fees routed here on every swap
  const EVM_TREASURY = '0xfe4a53af5336eba5d675d95e9795aCd6C05Ad9A4';
  const SOL_TREASURY = 'Ar6uFNvdFATXEA3nNtSmUyYv7WG3QAsaURjESs313TUy';
  const TREASURY_WALLETS: Record<string, string> = {
    ethereum: EVM_TREASURY,
    solana: SOL_TREASURY,
    bsc: EVM_TREASURY,
    base: EVM_TREASURY,
    polygon: EVM_TREASURY,
    arbitrum: EVM_TREASURY,
    avalanche: EVM_TREASURY,
  };

  // Use Alchemy for accurate real gas price (non-blocking)
  let realGasUsd = gasEstimate;
  if (chain !== 'solana') {
    try {
      const alchemyGas = await fetchAlchemyGasPrice(chain);
      if (alchemyGas > 0) realGasUsd = alchemyGas;
    } catch {}
  }

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
    gasEstimateUsd: parseFloat(realGasUsd.toFixed(4)),
    platformFee: {
      rate: PLATFORM_FEE_RATE,
      ratePercent: `${(PLATFORM_FEE_RATE * 100).toFixed(1)}%`,
      amountUsd: parseFloat(platformFeeUsd.toFixed(4)),
      treasuryWallet: TREASURY_WALLETS[chain] || TREASURY_WALLETS.ethereum,
    },
    route: {
      dex: dexName,
      chain,
      fromAddress,
      toAddress,
      hops: 1,
    },
    validUntil: Date.now() + 30000,
    priceSource: 'binance+dexscreener',
  });
}

// POST endpoint: proxy DEX APIs for swap execution to avoid CORS
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, fromToken, toToken, amount, chain, walletAddress, slippage = 0.5, contractAddress } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    // ── Alchemy Simulation — preview swap outcome before signing ─────────────
    if (action === 'simulate') {
      const { txFrom, txTo, txData, txValue, txChain } = body;
      if (!txFrom || !txTo || !txData) {
        return NextResponse.json({ error: 'Missing tx fields for simulation' }, { status: 400 });
      }
      const { simulateTransaction, normalizeChain } = await import('@/lib/alchemy');
      const alchemyChain = normalizeChain(txChain || 'ethereum');
      const result = await simulateTransaction(alchemyChain, {
        from: txFrom, to: txTo, data: txData, value: txValue || '0x0',
      });
      return NextResponse.json(result);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── GoPlus Token Security Check ───────────────────────────────────────────
    // Run security check before any swap execution
    if (action === 'security-check' || action === '1inch-swap' || action === 'raydium-compute') {
      const tokenToCheck = contractAddress || (toToken && COMMON_TOKENS[chain || 'ethereum']?.[toToken]);
      if (tokenToCheck && tokenToCheck !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        try {
          const { scanTokenSecurity } = await import('@/lib/security/goplusService');
          const scanResult = await scanTokenSecurity(tokenToCheck, chain || 'ethereum');

          if (action === 'security-check') {
            return NextResponse.json({
              trustScore: scanResult.trustScore,
              safetyLevel: scanResult.safetyLevel,
              safetyColor: scanResult.safetyColor,
              isHoneypot: scanResult.isHoneypot,
              buyTax: (scanResult.buyTax * 100).toFixed(1) + '%',
              sellTax: (scanResult.sellTax * 100).toFixed(1) + '%',
              checks: scanResult.checks,
              blocked: scanResult.isHoneypot || scanResult.buyTax > 0.25 || scanResult.sellTax > 0.25,
              blockReason: scanResult.isHoneypot
                ? 'Honeypot detected. This token cannot be sold.'
                : (scanResult.buyTax > 0.25 || scanResult.sellTax > 0.25)
                ? `Extremely high tax detected (buy: ${(scanResult.buyTax * 100).toFixed(0)}%, sell: ${(scanResult.sellTax * 100).toFixed(0)}%). Swap blocked.`
                : null,
            });
          }

          // Auto-block for execution actions
          if (scanResult.isHoneypot) {
            return NextResponse.json({
              error: 'Security check failed: Honeypot detected. This token cannot be sold. Swap blocked for your protection.',
              blocked: true,
              securityLevel: 'DANGER',
            }, { status: 403 });
          }
          if (scanResult.sellTax > 0.25) {
            return NextResponse.json({
              error: `Security check failed: Sell tax is ${(scanResult.sellTax * 100).toFixed(0)}% — extremely high. Swap blocked.`,
              blocked: true,
              securityLevel: 'DANGER',
            }, { status: 403 });
          }
        } catch {
          // Security check failed silently — allow swap to proceed
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // --- Solana: proxy Raydium compute swap ---
    if (action === 'raydium-compute') {
      const { inputMint, outputMint, amountLamports } = body;
      const url = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${Math.round(slippage * 100)}&txVersion=V0`;
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data?.message || 'Raydium compute error' }, { status: res.status });
      }
      return NextResponse.json(data);
    }

    // --- Solana: proxy Raydium build transaction ---
    if (action === 'raydium-build-tx') {
      const { computeData, walletAddress: wallet } = body;
      const res = await fetch('https://transaction-v1.raydium.io/transaction/swap-base-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          computeSwapResponse: computeData,
          txVersion: 'V0',
          wallet,
          wrapSol: true,
          unwrapSol: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data?.message || 'Raydium transaction build error' }, { status: res.status });
      }
      return NextResponse.json(data);
    }

    // --- EVM: proxy 1inch swap quote + tx data ---
    if (action === '1inch-swap') {
      const chainId = CHAIN_IDS[chain] || 1;
      const fromAddress = COMMON_TOKENS[chain]?.[fromToken] || fromToken;
      const toAddress = COMMON_TOKENS[chain]?.[toToken] || toToken;

      // Convert human amount to wei (assuming 18 decimals for most tokens, 6 for USDC/USDT)
      const DECIMALS: Record<string, number> = {
        USDC: 6, USDT: 6, WBTC: 8, BONK: 5, WIF: 6, JUP: 6, RAY: 6,
      };
      const decimals = DECIMALS[fromToken] ?? 18;
      const amountInWei = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals)).toString();

      const apiKey = process.env.ONEINCH_API_KEY || '';
      const url = `https://api.1inch.dev/swap/v6.0/${chainId}/swap?src=${fromAddress}&dst=${toAddress}&amount=${amountInWei}&from=${walletAddress}&slippage=${slippage}&disableEstimate=true`;

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data?.description || data?.error || '1inch API error' }, { status: res.status });
      }
      return NextResponse.json({ tx: data.tx, toAmount: data.toAmount });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
