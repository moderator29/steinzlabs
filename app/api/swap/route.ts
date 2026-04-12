import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenPrice } from '@/lib/services/coingecko';
import { searchPairs } from '@/lib/services/dexscreener';
import { getTokenSecurity } from '@/lib/services/goplus';
import { simulateTransaction, getGasPrice } from '@/lib/services/alchemy';

// ─── Token Configuration ──────────────────────────────────────────────────────

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

// CoinGecko coin ID map for known token symbols
const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', MATIC: 'matic-network',
  AVAX: 'avalanche-2', WBTC: 'wrapped-bitcoin', USDC: 'usd-coin', USDT: 'tether',
  DAI: 'dai', LINK: 'chainlink', UNI: 'uniswap', ARB: 'arbitrum',
  OP: 'optimism', AAVE: 'aave', MKR: 'maker', CRV: 'curve-dao-token',
  PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk', JUP: 'jupiter-exchange-solana',
  RAY: 'raydium', NAKA: 'nakamoto-games', DOGE: 'dogecoin', SHIB: 'shiba-inu',
  XRP: 'ripple', ADA: 'cardano',
};

// Stablecoins — always $1, never stale
const STABLECOIN_PRICES: Record<string, number> = {
  USDC: 1, USDT: 1, DAI: 1, BUSD: 1, TUSD: 1, FRAX: 1,
};

// Chain ID mapping for EVM chains
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, polygon: 137, bsc: 56, avalanche: 43114, arbitrum: 42161,
};

// ─── Platform Fee ─────────────────────────────────────────────────────────────
// 15bps = 0.15% per STEINZ master engineering specification

const PLATFORM_FEE_BPS = 15;
const PLATFORM_FEE_RATE = PLATFORM_FEE_BPS / 10_000; // 0.0015

// ─── Treasury ─────────────────────────────────────────────────────────────────

const EVM_TREASURY = '0xfe4a53af5336eba5d675d95e9795aCd6C05Ad9A4';
const TREASURY_WALLETS: Record<string, string> = {
  ethereum: EVM_TREASURY,
  solana:   'Ar6uFNvdFATXEA3nNtSmUyYv7WG3QAsaURjESs313TUy',
  bsc:      EVM_TREASURY,
  base:     EVM_TREASURY,
  polygon:  EVM_TREASURY,
  arbitrum: EVM_TREASURY,
  avalanche: EVM_TREASURY,
};

// ─── Price Cache ──────────────────────────────────────────────────────────────

let priceCache: { prices: Record<string, number>; ts: number } = { prices: {}, ts: 0 };
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Fetch live prices for a list of token symbols via the service layer.
 * Priority: stablecoins (hardcoded) → CoinGecko → DexScreener fallback.
 */
async function fetchLivePrices(tokens: string[]): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - priceCache.ts < CACHE_TTL && tokens.every(t => priceCache.prices[t] !== undefined)) {
    return priceCache.prices;
  }

  const prices: Record<string, number> = { ...priceCache.prices };

  // Stablecoins — fixed price, never stale
  for (const t of tokens) {
    if (STABLECOIN_PRICES[t]) prices[t] = STABLECOIN_PRICES[t];
  }

  // CoinGecko service layer for known tokens (parallel)
  const cgTokens = tokens.filter(t => !prices[t] && COINGECKO_IDS[t]);
  await Promise.allSettled(
    cgTokens.map(async t => {
      try {
        const price = await getTokenPrice(COINGECKO_IDS[t]);
        if (price > 0) prices[t] = price;
      } catch {}
    })
  );

  // DexScreener service layer fallback for any remaining tokens
  const missing = tokens.filter(t => !prices[t]);
  await Promise.allSettled(
    missing.map(async t => {
      try {
        const pairs = await searchPairs(t);
        const best = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        if (best?.priceUsd) prices[t] = parseFloat(String(best.priceUsd));
      } catch {}
    })
  );

  priceCache = { prices, ts: now };
  return prices;
}

// ─── Gas Estimation ───────────────────────────────────────────────────────────

const NATIVE_SYMBOLS: Record<string, string> = {
  ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH',
  polygon: 'MATIC', avalanche: 'AVAX', bsc: 'BNB',
};

const STATIC_GAS_USD: Record<string, number> = {
  base: 0.02, polygon: 0.01, bsc: 0.10, avalanche: 0.05, arbitrum: 0.15,
};

/**
 * Estimate swap gas cost in USD (~200k gas units) for a given chain.
 * Uses Alchemy service layer for real-time gas price; falls back to static table.
 */
async function estimateGasUsd(chain: string): Promise<number> {
  if (chain === 'solana') return 0.001;
  try {
    const gasPriceGwei = await getGasPrice(chain);
    if (gasPriceGwei <= 0) return STATIC_GAS_USD[chain] ?? 2.40;
    const nativeSym = NATIVE_SYMBOLS[chain] ?? 'ETH';
    const nativePrice = priceCache.prices[nativeSym] ?? 0;
    if (nativePrice <= 0) return STATIC_GAS_USD[chain] ?? 2.40;
    const gasCostNative = (gasPriceGwei * 1e9 * 200_000) / 1e18;
    return gasCostNative * nativePrice;
  } catch {
    return STATIC_GAS_USD[chain] ?? 2.40;
  }
}

// ─── GET Handler — Swap Quote ─────────────────────────────────────────────────

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

  // Fetch live prices via service layer
  let livePrices: Record<string, number> = {};
  try {
    livePrices = await fetchLivePrices([fromToken, toToken]);
  } catch {}

  const fromPrice = livePrices[fromToken] ?? STABLECOIN_PRICES[fromToken];
  const toPrice = livePrices[toToken] ?? STABLECOIN_PRICES[toToken];

  if (!fromPrice || !toPrice) {
    return NextResponse.json(
      { error: `Live price unavailable for ${!fromPrice ? fromToken : toToken}. Try again.` },
      { status: 503 }
    );
  }

  const fromUsd = amountNum * fromPrice;
  const platformFeeUsd = fromUsd * PLATFORM_FEE_RATE;
  const amountAfterFee = fromUsd - platformFeeUsd;
  const toAmount = amountAfterFee / toPrice;

  const priceImpact = amountNum > 1000 ? 0.15 : amountNum > 100 ? 0.05 : 0.01;
  const minReceived = toAmount * (1 - slippage / 100);

  const fromAddress = COMMON_TOKENS[chain]?.[fromToken] || '0x0';
  const toAddress = COMMON_TOKENS[chain]?.[toToken] || '0x0';
  const dexName =
    chain === 'solana'    ? 'Raydium'     :
    chain === 'bsc'       ? 'PancakeSwap' :
    chain === 'polygon'   ? 'QuickSwap'   :
    chain === 'avalanche' ? 'TraderJoe'   :
    chain === 'arbitrum'  ? 'Camelot'     :
    chain === 'base'      ? 'Aerodrome'   : 'Uniswap V3';

  const realGasUsd = await estimateGasUsd(chain).catch(() => STATIC_GAS_USD[chain] ?? 2.40);

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
      ratePercent: `${(PLATFORM_FEE_RATE * 100).toFixed(2)}%`,
      feeBps: PLATFORM_FEE_BPS,
      amountUsd: parseFloat(platformFeeUsd.toFixed(4)),
      treasuryWallet: TREASURY_WALLETS[chain] || EVM_TREASURY,
    },
    route: {
      dex: dexName,
      chain,
      fromAddress,
      toAddress,
      hops: 1,
    },
    validUntil: Date.now() + 30_000,
    priceSource: 'coingecko+dexscreener',
  });
}

// ─── POST Handler — Swap Execution ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action, fromToken, toToken, amount, chain,
      walletAddress, slippage = 0.5, contractAddress,
    } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    // ── Alchemy Transaction Simulation ────────────────────────────────────────
    if (action === 'simulate') {
      const { txFrom, txTo, txData, txValue, txChain } = body;
      if (!txFrom || !txTo || !txData) {
        return NextResponse.json({ error: 'Missing tx fields for simulation' }, { status: 400 });
      }
      const result = await simulateTransaction(txChain || 'ethereum', {
        from: txFrom, to: txTo, data: txData, value: txValue || '0x0',
      });
      return NextResponse.json(result);
    }

    // ── GoPlus Token Security Pre-Check ───────────────────────────────────────
    if (action === 'security-check' || action === '1inch-swap' || action === 'raydium-compute') {
      const tokenToCheck = contractAddress || (toToken && COMMON_TOKENS[chain || 'ethereum']?.[toToken]);
      if (tokenToCheck && tokenToCheck !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        try {
          const scanResult = await getTokenSecurity(tokenToCheck, chain || 'ethereum');

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

          // Auto-block execution actions on dangerous tokens
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

    // ── Solana: proxy Raydium compute swap ────────────────────────────────────
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

    // ── Solana: proxy Raydium build transaction ───────────────────────────────
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

    // ── EVM: proxy 1inch swap quote + tx data ────────────────────────────────
    if (action === '1inch-swap') {
      const chainId = CHAIN_IDS[chain] || 1;
      const fromAddress = COMMON_TOKENS[chain]?.[fromToken] || fromToken;
      const toAddress = COMMON_TOKENS[chain]?.[toToken] || toToken;

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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
