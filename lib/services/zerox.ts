import 'server-only';
import { addressesEqual } from '@/lib/utils/addressNormalize';

/**
 * 0x Protocol Service Layer
 * Handles all 0x API calls: Swap API, Gasless API, Trade Analytics API.
 * This is the ONLY file that calls 0x APIs directly.
 */

const BASE_URL = 'https://api.0x.org';
const TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [250, 500, 1000];

/**
 * fetch with retry+backoff for transient 5xx / network errors. 0x flakes
 * occasionally with 502/503; surfacing those as a hard throw on the trader's
 * first attempt is a worse UX than retrying. 4xx responses are NOT retried
 * (input error, no point).
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (res.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      return res; // 4xx: surface to caller
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('0x request failed after retries');
}

function getHeaders(serverSide = false): Record<string, string> {
  const key = serverSide
    ? (process.env.ZX_API_KEY || process.env.NEXT_PUBLIC_ZX_API_KEY || '')
    : (process.env.NEXT_PUBLIC_ZX_API_KEY || '');
  return {
    '0x-api-key': key,
    '0x-version': 'v2',
    'Content-Type': 'application/json',
  };
}

export const ZX_CHAIN_IDS: Record<string, number> = {
  ethereum: 1, eth: 1,
  base: 8453,
  arbitrum: 42161, arb: 42161,
  polygon: 137,
  avalanche: 43114,
  bsc: 56, bnb: 56,
  optimism: 10, op: 10,
  scroll: 534352,
  linea: 59144,
  blast: 81457,
};

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export function isNativeToken(address: string): boolean {
  // 0x is always EVM; the chain hint isn't critical here, but going through
  // addressesEqual keeps the comparison consistent with the rest of the codebase.
  return addressesEqual(address, NATIVE_TOKEN, 'ethereum')
    || address === '0x0000000000000000000000000000000000000000';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ZxPriceResponse {
  buyAmount: string;
  sellAmount: string;
  gas: string;
  gasPrice: string;
  liquidityAvailable: boolean;
  route?: { fills: Array<{ source: string; proportionBps: string }> };
  fees?: {
    integratorFee?: { amount: string; token: string; type: string };
    zeroExFee?: { amount: string; token: string; type: string };
  };
}

export interface ZxQuoteResponse extends ZxPriceResponse {
  transaction: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
  allowanceTarget: string;
}

export interface ZxGaslessQuoteResponse {
  liquidityAvailable: boolean;
  buyAmount: string;
  sellAmount: string;
  trade?: Record<string, unknown>;
  approval?: Record<string, unknown>;
  fees?: Record<string, unknown>;
}

export interface ZxTradeRecord {
  txHash: string;
  chainId: number;
  timestamp: string;
  sellToken: { address: string; symbol: string; amount: string; amountUsd: string };
  buyToken: { address: string; symbol: string; amount: string; amountUsd: string };
  integratorFee?: { amount: string; amountUsd: string };
  zeroExFee?: { amount: string; amountUsd: string };
  gas: string;
  slippage: string;
  taker: string;
}

// ─── SWAP API ────────────────────────────────────────────────────────────────

export async function getSwapPrice(params: {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  taker?: string;
}): Promise<ZxPriceResponse> {
  const feeRecipient = process.env.NEXT_PUBLIC_FEE_RECIPIENT_EVM || '';
  const feePct = process.env.NEXT_PUBLIC_STEINZ_FEE_PERCENT || '0.005';

  const qs = new URLSearchParams({
    chainId: String(params.chainId),
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount,
  });
  if (params.taker) qs.set('taker', params.taker);
  if (feeRecipient) {
    qs.set('feeRecipient', feeRecipient);
    qs.set('buyTokenPercentageFee', feePct);
  }

  const res = await fetchWithRetry(`${BASE_URL}/swap/allowance-holder/price?${qs}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`0x Swap price error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getSwapQuote(params: {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  taker: string;
  // §3 P1-D.3 — opt into 0x's Permit2 endpoint so first-time swappers
  // don't need a separate approval tx (the permit signature + swap go in
  // one click). Callers set this when the from-token has no pre-existing
  // allowance against the 0x AllowanceHolder.
  permit2?: boolean;
}): Promise<ZxQuoteResponse> {
  const feeRecipient = process.env.NEXT_PUBLIC_FEE_RECIPIENT_EVM || '';
  const feePct = process.env.NEXT_PUBLIC_STEINZ_FEE_PERCENT || '0.005';

  const qs = new URLSearchParams({
    chainId: String(params.chainId),
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount,
    taker: params.taker,
  });
  if (feeRecipient) {
    qs.set('feeRecipient', feeRecipient);
    qs.set('buyTokenPercentageFee', feePct);
  }

  const path = params.permit2 ? '/swap/permit2/quote' : '/swap/allowance-holder/quote';
  const res = await fetchWithRetry(`${BASE_URL}${path}?${qs}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`0x Swap quote error (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * §3 P1-D.3 — light allowance probe. Calls the ERC20 `allowance(owner,
 * spender)` view via the chain's public RPC and returns `true` when the
 * existing allowance is below the requested sellAmount (so the caller
 * should switch to the Permit2 endpoint above). Falls open (returns
 * false) on RPC errors — better to do the legacy 2-tx flow than to
 * block the swap on a transient RPC blip.
 *
 * 0x's universal Permit2 spender is the same across all EVM chains it
 * supports: 0x000000000022D473030F116dDEE9F6B43aC78BA3.
 */
const PERMIT2_SPENDER = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const RPC_BY_CHAIN_ID: Record<number, string | undefined> = {
  1:     process.env.ETHEREUM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  8453:  process.env.BASE_RPC_URL     ?? (process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  42161: process.env.ARBITRUM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  137:   process.env.POLYGON_RPC_URL  ?? (process.env.ALCHEMY_API_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  10:    process.env.OPTIMISM_RPC_URL ?? (process.env.ALCHEMY_API_KEY ? `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined),
  56:    process.env.BSC_RPC_URL      ?? 'https://bsc-dataseed.binance.org',
};

export async function needsPermit2(params: {
  chainId: number;
  sellToken: string;
  owner: string;
  sellAmount: string;
}): Promise<boolean> {
  const rpc = RPC_BY_CHAIN_ID[params.chainId];
  if (!rpc) return false;
  // Native asset (no allowance concept) — never needs Permit2.
  if (params.sellToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return false;

  // allowance(owner, spender) selector = 0xdd62ed3e
  const owner = params.owner.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const spender = PERMIT2_SPENDER.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const data = `0xdd62ed3e${owner}${spender}`;

  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: params.sellToken, data }, 'latest'],
      }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { result?: string };
    if (!json.result || json.result === '0x') return false;
    const allowance = BigInt(json.result);
    const requested = BigInt(params.sellAmount);
    return allowance < requested;
  } catch {
    return false;
  }
}

// ─── GASLESS API ─────────────────────────────────────────────────────────────

export async function getGaslessPrice(params: {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  taker: string;
}): Promise<ZxGaslessQuoteResponse> {
  const feeRecipient = process.env.NEXT_PUBLIC_FEE_RECIPIENT_EVM || '';
  const feeBps = process.env.NEXT_PUBLIC_STEINZ_FEE_BPS || '40';

  const qs = new URLSearchParams({
    chainId: String(params.chainId),
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount,
    taker: params.taker,
  });
  if (feeRecipient) {
    qs.set('swapFeeRecipient', feeRecipient);
    qs.set('swapFeeBps', feeBps);
    qs.set('swapFeeToken', params.buyToken);
  }

  const res = await fetchWithRetry(`${BASE_URL}/gasless/price?${qs}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`0x Gasless price error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getGaslessQuote(params: {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  taker: string;
}): Promise<ZxGaslessQuoteResponse> {
  const feeRecipient = process.env.NEXT_PUBLIC_FEE_RECIPIENT_EVM || '';
  const feeBps = process.env.NEXT_PUBLIC_STEINZ_FEE_BPS || '40';

  const qs = new URLSearchParams({
    chainId: String(params.chainId),
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount,
    taker: params.taker,
  });
  if (feeRecipient) {
    qs.set('swapFeeRecipient', feeRecipient);
    qs.set('swapFeeBps', feeBps);
    qs.set('swapFeeToken', params.buyToken);
  }

  const res = await fetchWithRetry(`${BASE_URL}/gasless/quote?${qs}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`0x Gasless quote error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function submitGasless(body: Record<string, unknown>): Promise<{ tradeHash: string }> {
  const res = await fetchWithRetry(`${BASE_URL}/gasless/submit`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`0x Gasless submit error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getGaslessStatus(tradeHash: string): Promise<{ status: string; txHash?: string }> {
  const res = await fetchWithRetry(`${BASE_URL}/gasless/status/${tradeHash}`, {
    headers: getHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`0x Gasless status error (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── TRADE ANALYTICS API (SERVER-SIDE ONLY) ──────────────────────────────────

export async function getSwapTrades(): Promise<ZxTradeRecord[]> {
  const res = await fetchWithRetry(`${BASE_URL}/trade-analytics/swap`, {
    headers: getHeaders(true),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`0x Trade Analytics error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return (data.trades ?? data) as ZxTradeRecord[];
}

export async function getGaslessTrades(): Promise<ZxTradeRecord[]> {
  const res = await fetchWithRetry(`${BASE_URL}/trade-analytics/gasless`, {
    headers: getHeaders(true),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`0x Gasless Analytics error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return (data.trades ?? data) as ZxTradeRecord[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getChainId(chain: string): number | null {
  return ZX_CHAIN_IDS[chain.toLowerCase()] ?? null;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    42161: 'https://arbiscan.io/tx/',
    137: 'https://polygonscan.com/tx/',
    43114: 'https://snowtrace.io/tx/',
    56: 'https://bscscan.com/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
  };
  const base = explorers[chainId] || 'https://etherscan.io/tx/';
  return `${base}${txHash}`;
}
