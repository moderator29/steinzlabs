import 'server-only';
import { ethers } from 'ethers';

/**
 * Uniswap v3 EVM Swap Routing
 *
 * Uses:
 *  - Uniswap v3 Subgraph to discover the highest-liquidity pool fee tier
 *  - QuoterV2 contract to get an exact on-chain quote
 *  - SwapRouter02 ABI to encode the swap transaction
 *
 * Supported chains: Ethereum, Base, Arbitrum, Optimism, BNB
 */

// ─── Contract Addresses ───────────────────────────────────────────────────────

const SWAP_ROUTER_02: Record<string, string> = {
  ethereum: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  base:     '0x2626664c2603336E57B271c5C0b26F421741e481',
  arbitrum: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  optimism: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  bsc:      '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2',
};

const QUOTER_V2: Record<string, string> = {
  ethereum: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  base:     '0x3d4e44Eb1374240CE5F1B136041dd501e897b9fA',
  arbitrum: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  optimism: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  bsc:      '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
};

// WETH/WBNB native wrappers (needed for ETH→token quotes)
const WRAPPED_NATIVE: Record<string, string> = {
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  base:     '0x4200000000000000000000000000000000000006',
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  optimism: '0x4200000000000000000000000000000000000006',
  bsc:      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
};

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, arbitrum: 42161, optimism: 10, bsc: 56,
};

// Uniswap v3 Subgraph endpoints
const SUBGRAPH_URLS: Record<string, string> = {
  ethereum: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  base:     'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-base',
  arbitrum: 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal',
  optimism: 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis',
  bsc:      'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-bsc',
};

// Alchemy RPC URLs
function getRpcUrl(chain: string): string {
  const key = process.env.ALCHEMY_API_KEY ?? '';
  const rpcMap: Record<string, string> = {
    ethereum: `https://eth-mainnet.g.alchemy.com/v2/${key}`,
    base:     `https://base-mainnet.g.alchemy.com/v2/${key}`,
    arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${key}`,
    optimism: `https://opt-mainnet.g.alchemy.com/v2/${key}`,
    bsc:      `https://bnb-mainnet.g.alchemy.com/v2/${key}`,
  };
  return rpcMap[chain] ?? rpcMap.ethereum;
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const QUOTER_V2_ABI = [
  'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const SWAP_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)',
  'function exactInput(tuple(bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UniswapV3Quote {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  feeTier: number;       // 100, 500, 3000, or 10000
  priceImpact: number;   // estimated %
  chain: string;
  route: 'single' | 'multi';
  gasEstimate?: bigint;
}

export interface UniswapV3SwapTx {
  to: string;
  data: string;
  value: string;           // hex
  chainId: number;
  gasLimit?: string;
}

// ─── Pool Discovery via Subgraph ──────────────────────────────────────────────

async function getBestFeeTier(
  tokenIn: string,
  tokenOut: string,
  chain: string,
): Promise<number> {
  const subgraphUrl = SUBGRAPH_URLS[chain];
  if (!subgraphUrl) return 3000; // default fee tier

  const t0 = tokenIn.toLowerCase();
  const t1 = tokenOut.toLowerCase();

  const query = `{
    pools(
      where: {
        or: [
          { token0: "${t0}", token1: "${t1}" },
          { token0: "${t1}", token1: "${t0}" }
        ]
      }
      orderBy: volumeUSD
      orderDirection: desc
      first: 5
    ) {
      feeTier
      liquidity
      volumeUSD
    }
  }`;

  try {
    const res = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return 3000;

    const data = await res.json();
    const pools: Array<{ feeTier: string; liquidity: string; volumeUSD: string }> =
      data?.data?.pools ?? [];

    if (pools.length === 0) return 3000;

    // Pick the pool with highest liquidity
    const best = pools.reduce((prev, cur) =>
      parseFloat(cur.liquidity) > parseFloat(prev.liquidity) ? cur : prev,
    );

    return parseInt(best.feeTier, 10);
  } catch {
    return 3000; // fallback to 0.3% tier
  }
}

// ─── On-chain Quote via QuoterV2 ─────────────────────────────────────────────

async function getOnChainQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  feeTier: number,
  chain: string,
): Promise<{ amountOut: bigint; gasEstimate: bigint } | null> {
  const quoterAddress = QUOTER_V2[chain];
  if (!quoterAddress) return null;

  try {
    const provider = new ethers.JsonRpcProvider(getRpcUrl(chain));
    const quoter = new ethers.Contract(quoterAddress, QUOTER_V2_ABI, provider);

    const result = await quoter.quoteExactInputSingle.staticCall({
      tokenIn,
      tokenOut,
      amountIn,
      fee: feeTier,
      sqrtPriceLimitX96: 0,
    });

    return {
      amountOut: result.amountOut,
      gasEstimate: result.gasEstimate,
    };
  } catch {
    return null;
  }
}

// ─── Main Quote Function ──────────────────────────────────────────────────────

export async function getUniswapV3Quote(params: {
  tokenIn: string;       // ERC-20 address or 'native' for ETH/BNB
  tokenOut: string;
  amountIn: bigint;
  chain: string;
}): Promise<UniswapV3Quote | null> {
  const { tokenIn: rawIn, tokenOut, amountIn, chain } = params;
  const wrappedNative = WRAPPED_NATIVE[chain];

  // Resolve native token to its wrapped form
  const tokenIn =
    rawIn.toLowerCase() === 'native' || rawIn.toLowerCase() === ethers.ZeroAddress
      ? (wrappedNative ?? rawIn)
      : rawIn;

  // Discover best fee tier from subgraph
  const feeTier = await getBestFeeTier(tokenIn, tokenOut, chain);

  // Get on-chain exact quote
  const quoteResult = await getOnChainQuote(tokenIn, tokenOut, amountIn, feeTier, chain);
  if (!quoteResult) return null;

  // Rough price impact estimate: (amountIn - effective amountOut in same units) / amountIn
  // Without a reference price we approximate as 0 for now; callers can enrich this
  const priceImpact = 0;

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut: quoteResult.amountOut,
    feeTier,
    priceImpact,
    chain,
    route: 'single',
    gasEstimate: quoteResult.gasEstimate,
  };
}

// ─── Build Swap Transaction ───────────────────────────────────────────────────

export function buildUniswapV3SwapTx(params: {
  quote: UniswapV3Quote;
  recipient: string;
  slippageBps: number;   // e.g. 50 = 0.5%
  deadlineSeconds?: number;
}): UniswapV3SwapTx | null {
  const { quote, recipient, slippageBps, deadlineSeconds = 1200 } = params;
  const routerAddress = SWAP_ROUTER_02[quote.chain];
  if (!routerAddress) return null;

  const chainId = CHAIN_IDS[quote.chain] ?? 1;

  // Minimum amount out with slippage protection
  const slippageFactor = BigInt(10_000 - slippageBps);
  const amountOutMinimum = (quote.amountOut * slippageFactor) / BigInt(10_000);

  // Determine if tokenIn is native
  const wrappedNative = WRAPPED_NATIVE[quote.chain] ?? '';
  const isNativeIn = quote.tokenIn.toLowerCase() === wrappedNative.toLowerCase();
  const value = isNativeIn ? '0x' + quote.amountIn.toString(16) : '0x0';

  // Encode exactInputSingle call
  const iface = new ethers.Interface(SWAP_ROUTER_ABI);
  const data = iface.encodeFunctionData('exactInputSingle', [{
    tokenIn: quote.tokenIn,
    tokenOut: quote.tokenOut,
    fee: quote.feeTier,
    recipient,
    amountIn: quote.amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96: 0,
  }]);

  return {
    to: routerAddress,
    data,
    value,
    chainId,
    gasLimit: quote.gasEstimate
      ? '0x' + (quote.gasEstimate * BigInt(130) / BigInt(100)).toString(16) // 30% gas buffer
      : undefined,
  };
}
