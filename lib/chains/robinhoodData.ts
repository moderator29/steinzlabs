import 'server-only';
import { getEvmRpcUrl, getEvmChainMeta } from './evmRpc';
import {
  goldrushEnabled,
  goldrushSupportsChain,
  getWalletBalances,
  getWalletTransactions,
  type GoldrushBalance,
  type GoldrushTx,
} from '@/lib/services/goldrush';

/**
 * Robinhood Chain data helper.
 *
 * Robinhood Chain (Arbitrum-Orbit L2, chain id 4663) is brand-new: the platform
 * previously only had RAW RPC for it (native ETH balance via eth_getBalance) —
 * no token-level holdings or USD pricing. GoldRush (Covalent) can index 100+
 * chains and PREFERS to serve richer data when its key is configured.
 *
 * This helper prefers GoldRush when enabled AND a verified/overridden Robinhood
 * slug is available (goldrushSupportsChain), otherwise degrades HONESTLY to the
 * raw RPC native-balance path. It never fabricates token holdings or prices.
 *
 * NOTE on the GoldRush slug: at build time Robinhood's GoldRush chainName was
 * not published/verifiable, so it is NOT hardcoded. Set GOLDRUSH_ROBINHOOD_CHAIN
 * to the real slug once known and the GoldRush path lights up automatically;
 * until then this transparently uses RPC. (See lib/services/goldrush.ts.)
 */

const ROBINHOOD = 'robinhood';

export interface RobinhoodHolding {
  contractAddress: string | null;
  symbol: string;
  name: string;
  amount: number;
  valueUSD: number | null;
  priceUSD: number | null;
  isNative: boolean;
}

export interface RobinhoodBalances {
  address: string;
  chain: 'robinhood';
  /** where the data came from — so UIs can label it honestly */
  source: 'goldrush' | 'rpc';
  nativeSymbol: string;
  nativeBalance: number;
  totalValueUSD: number | null;
  holdings: RobinhoodHolding[];
}

/** True when GoldRush is the active data path for Robinhood (key set + slug known). */
export function robinhoodUsesGoldRush(): boolean {
  return goldrushEnabled() && goldrushSupportsChain(ROBINHOOD);
}

function mapGoldrushHolding(b: GoldrushBalance): RobinhoodHolding {
  return {
    contractAddress: b.contractAddress,
    symbol: b.symbol,
    name: b.name,
    amount: b.amount,
    valueUSD: b.valueUSD,
    priceUSD: b.priceUSD,
    isNative: b.isNative,
  };
}

/** Raw-RPC fallback: native ETH balance only (no token/USD data available). */
async function nativeBalanceViaRpc(address: string): Promise<number | null> {
  const url = getEvmRpcUrl(ROBINHOOD);
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string };
    if (!json.result) return null;
    return Number(BigInt(json.result)) / 1e18;
  } catch {
    return null;
  }
}

/**
 * Wallet balances on Robinhood Chain. Prefers GoldRush (full token holdings +
 * USD values) when enabled; otherwise returns the native ETH balance from RPC
 * with an empty holdings list and null USD (honest — token pricing isn't
 * available without GoldRush). Returns null only if BOTH paths fail entirely.
 */
export async function getRobinhoodWalletBalances(address: string): Promise<RobinhoodBalances | null> {
  if (!address) return null;
  const meta = getEvmChainMeta(ROBINHOOD);
  const nativeSymbol = meta?.nativeSymbol ?? 'ETH';

  if (robinhoodUsesGoldRush()) {
    const balances = await getWalletBalances(ROBINHOOD, address);
    if (balances.length > 0) {
      const native = balances.find((b) => b.isNative);
      const totalValueUSD = balances.reduce((s, b) => s + (b.valueUSD ?? 0), 0);
      return {
        address,
        chain: ROBINHOOD,
        source: 'goldrush',
        nativeSymbol: native?.symbol || nativeSymbol,
        nativeBalance: native?.amount ?? 0,
        totalValueUSD: Math.round(totalValueUSD * 100) / 100,
        holdings: balances.map(mapGoldrushHolding),
      };
    }
    // GoldRush enabled but empty/failed → fall through to RPC rather than lie.
  }

  const nativeBalance = await nativeBalanceViaRpc(address);
  if (nativeBalance === null) return null;
  return {
    address,
    chain: ROBINHOOD,
    source: 'rpc',
    nativeSymbol,
    nativeBalance,
    totalValueUSD: null, // no USD pricing without GoldRush — honest null, not 0-as-fact
    holdings: [],
  };
}

/**
 * Recent Robinhood Chain transactions for an address. Only available via
 * GoldRush; returns [] (never throws) when GoldRush isn't the active path.
 */
export async function getRobinhoodWalletTransactions(
  address: string,
  opts: { pageSize?: number } = {},
): Promise<GoldrushTx[]> {
  if (!address || !robinhoodUsesGoldRush()) return [];
  return getWalletTransactions(ROBINHOOD, address, opts);
}
