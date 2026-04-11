/**
 * STEINZ LABS — Alchemy Multi-Chain Client
 *
 * Single source of truth for all Alchemy RPC calls across every EVM chain.
 * All wallet intelligence, token balances, transfers, and simulation flow through here.
 *
 * Supported chains: Ethereum, Base, Polygon, Arbitrum, Optimism, Avalanche, BNB
 */

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || '';

export type AlchemyChain =
  | 'ethereum'
  | 'base'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'avalanche'
  | 'bnb';

// Chain ID → Alchemy RPC subdomain
const CHAIN_RPC: Record<AlchemyChain, string> = {
  ethereum: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  base:     `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  polygon:  `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  optimism: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  avalanche:`https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  bnb:      `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
};

// Native token symbol per chain
export const CHAIN_NATIVE: Record<AlchemyChain, string> = {
  ethereum: 'ETH', base: 'ETH', polygon: 'MATIC', arbitrum: 'ETH',
  optimism: 'ETH', avalanche: 'AVAX', bnb: 'BNB',
};

export const CHAIN_EXPLORER: Record<AlchemyChain, string> = {
  ethereum: 'https://etherscan.io',
  base:     'https://basescan.org',
  polygon:  'https://polygonscan.com',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
  avalanche:'https://snowtrace.io',
  bnb:      'https://bscscan.com',
};

export function getRpcUrl(chain: AlchemyChain): string {
  return CHAIN_RPC[chain];
}

export function isAlchemyConfigured(): boolean {
  return ALCHEMY_KEY.length > 10;
}

// Detect chain from address context or explicit chain param
export function normalizeChain(chain: string): AlchemyChain {
  const c = chain.toLowerCase().trim();
  if (c === 'eth' || c === 'ethereum' || c === 'mainnet' || c === '1') return 'ethereum';
  if (c === 'base' || c === '8453') return 'base';
  if (c === 'polygon' || c === 'matic' || c === '137') return 'polygon';
  if (c === 'arbitrum' || c === 'arb' || c === '42161') return 'arbitrum';
  if (c === 'optimism' || c === 'op' || c === '10') return 'optimism';
  if (c === 'avalanche' || c === 'avax' || c === '43114') return 'avalanche';
  if (c === 'bnb' || c === 'bsc' || c === '56') return 'bnb';
  return 'ethereum'; // default
}

async function rpc(chain: AlchemyChain, method: string, params: any[]): Promise<any> {
  const url = getRpcUrl(chain);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Alchemy ${chain} RPC error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Alchemy RPC error');
  return data.result;
}

// ─── Native Balance ────────────────────────────────────────────────────────

export async function getNativeBalance(address: string, chain: AlchemyChain): Promise<number> {
  const hex = await rpc(chain, 'eth_getBalance', [address, 'latest']);
  return parseInt(hex, 16) / 1e18;
}

// ─── Transaction Count ─────────────────────────────────────────────────────

export async function getTxCount(address: string, chain: AlchemyChain): Promise<number> {
  const hex = await rpc(chain, 'eth_getTransactionCount', [address, 'latest']);
  return parseInt(hex, 16);
}

// ─── Token Balances ────────────────────────────────────────────────────────

export interface TokenBalance {
  contractAddress: string;
  tokenBalance: string; // hex
  error?: string;
}

export async function getTokenBalances(address: string, chain: AlchemyChain): Promise<TokenBalance[]> {
  const result = await rpc(chain, 'alchemy_getTokenBalances', [address, 'DEFAULT_TOKENS']);
  return result?.tokenBalances || [];
}

// ─── Token Metadata ────────────────────────────────────────────────────────

export interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string | null;
}

export async function getTokenMetadata(contractAddress: string, chain: AlchemyChain): Promise<TokenMeta> {
  const result = await rpc(chain, 'alchemy_getTokenMetadata', [contractAddress]);
  return {
    name: result?.name || 'Unknown',
    symbol: result?.symbol || '???',
    decimals: result?.decimals ?? 18,
    logo: result?.logo || null,
  };
}

export async function getBatchTokenMetadata(addresses: string[], chain: AlchemyChain): Promise<Record<string, TokenMeta>> {
  const results = await Promise.allSettled(
    addresses.map(addr => getTokenMetadata(addr, chain))
  );
  const map: Record<string, TokenMeta> = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') map[addresses[i]] = r.value;
  });
  return map;
}

// ─── Asset Transfers (Transaction History) ─────────────────────────────────

export interface AssetTransfer {
  blockNum: string;
  hash: string;
  from: string;
  to: string | null;
  value: number | null;
  asset: string | null;
  category: string;
  rawContract?: { address: string | null; decimal: string | null; value: string | null };
  metadata?: { blockTimestamp?: string };
}

export async function getAssetTransfers(
  address: string,
  chain: AlchemyChain,
  direction: 'from' | 'to' | 'both' = 'both',
  maxCount = 30
): Promise<AssetTransfer[]> {
  const categories = ['external', 'erc20', 'erc721', 'erc1155', 'specialnft'];
  const baseParams = {
    withMetadata: true,
    excludeZeroValue: true,
    maxCount: `0x${maxCount.toString(16)}`,
    category: categories,
    order: 'desc',
  };

  if (direction === 'both') {
    const [sentRes, receivedRes] = await Promise.allSettled([
      rpc(chain, 'alchemy_getAssetTransfers', [{ ...baseParams, fromAddress: address }]),
      rpc(chain, 'alchemy_getAssetTransfers', [{ ...baseParams, toAddress: address }]),
    ]);
    const sent = sentRes.status === 'fulfilled' ? sentRes.value?.transfers || [] : [];
    const received = receivedRes.status === 'fulfilled' ? receivedRes.value?.transfers || [] : [];

    // Merge + dedupe by hash, sort by block desc
    const seen = new Set<string>();
    const merged: AssetTransfer[] = [];
    for (const tx of [...sent, ...received]) {
      if (!seen.has(tx.hash)) { seen.add(tx.hash); merged.push(tx); }
    }
    merged.sort((a, b) => parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16));
    return merged.slice(0, maxCount);
  }

  const key = direction === 'from' ? 'fromAddress' : 'toAddress';
  const result = await rpc(chain, 'alchemy_getAssetTransfers', [{ ...baseParams, [key]: address }]);
  return result?.transfers || [];
}

// ─── Alchemy Simulation API (Pre-Swap Preview) ─────────────────────────────

export interface SimulationResult {
  gasUsed: number;
  gasEstimateUsd: number;
  success: boolean;
  error?: string;
  balanceChanges: Array<{
    address: string;
    tokenAddress: string | null; // null = native ETH
    symbol: string;
    decimals: number;
    rawAmount: string;
    amount: number;
    direction: 'in' | 'out';
  }>;
}

export async function simulateTransaction(
  chain: AlchemyChain,
  tx: {
    from: string;
    to: string;
    data: string;
    value?: string; // hex
    gas?: string;   // hex
  }
): Promise<SimulationResult> {
  try {
    // Use alchemy_simulateAssetChanges for balance change preview
    const result = await rpc(chain, 'alchemy_simulateAssetChanges', [{
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: tx.value || '0x0',
    }]);

    const changes = (result?.changes || []).map((c: any) => ({
      address: c.from || c.to || tx.from,
      tokenAddress: c.contractAddress || null,
      symbol: c.symbol || 'ETH',
      decimals: c.decimals || 18,
      rawAmount: c.rawAmount || '0',
      amount: parseFloat(c.amount || '0'),
      direction: (c.changeType === 'APPROVE' || parseFloat(c.amount || '0') < 0) ? 'out' : 'in',
    }));

    return {
      gasUsed: parseInt(result?.gasUsed || '0x0', 16),
      gasEstimateUsd: 0, // caller can compute from gasUsed * gasPrice
      success: true,
      balanceChanges: changes,
    };
  } catch (err: any) {
    return {
      gasUsed: 0,
      gasEstimateUsd: 0,
      success: false,
      error: err.message || 'Simulation failed',
      balanceChanges: [],
    };
  }
}

// ─── Gas Estimate ──────────────────────────────────────────────────────────

export async function getGasPrice(chain: AlchemyChain): Promise<{ gwei: number; fast: number; standard: number; slow: number }> {
  try {
    const hex = await rpc(chain, 'eth_gasPrice', []);
    const gwei = parseInt(hex, 16) / 1e9;
    return { gwei, fast: gwei * 1.2, standard: gwei, slow: gwei * 0.8 };
  } catch {
    const defaults: Record<AlchemyChain, number> = {
      ethereum: 20, base: 0.002, polygon: 30, arbitrum: 0.1,
      optimism: 0.002, avalanche: 25, bnb: 3,
    };
    const g = defaults[chain] || 20;
    return { gwei: g, fast: g * 1.2, standard: g, slow: g * 0.8 };
  }
}

// ─── Full Wallet Scan ──────────────────────────────────────────────────────

export interface WalletScan {
  chain: AlchemyChain;
  address: string;
  nativeBalance: number;
  nativeSymbol: string;
  nativeUsd: number;
  txCount: number;
  tokens: Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: number;
    logo?: string | null;
    usdValue?: number;
  }>;
  recentTransactions: AssetTransfer[];
  explorerUrl: string;
}

export async function scanWallet(
  address: string,
  chain: AlchemyChain,
  nativePriceUsd = 0
): Promise<WalletScan> {
  const [nativeBal, txCount, rawBalances, recentTxs] = await Promise.allSettled([
    getNativeBalance(address, chain),
    getTxCount(address, chain),
    getTokenBalances(address, chain),
    getAssetTransfers(address, chain, 'both', 30),
  ]);

  const nativeBalance = nativeBal.status === 'fulfilled' ? nativeBal.value : 0;
  const txCountVal = txCount.status === 'fulfilled' ? txCount.value : 0;
  const rawToks = rawBalances.status === 'fulfilled' ? rawBalances.value : [];
  const recentTransactions = recentTxs.status === 'fulfilled' ? recentTxs.value : [];

  // Filter non-zero token balances
  const nonZero = rawToks.filter(t =>
    t.tokenBalance && t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
  );

  // Batch metadata fetch
  const addresses = nonZero.map(t => t.contractAddress).slice(0, 50);
  const metaMap = addresses.length > 0 ? await getBatchTokenMetadata(addresses, chain) : {};

  const tokens = nonZero.slice(0, 50).map(t => {
    const meta = metaMap[t.contractAddress] || { name: 'Unknown', symbol: '???', decimals: 18, logo: null };
    const rawBal = BigInt(t.tokenBalance || '0');
    const balance = Number(rawBal) / Math.pow(10, meta.decimals);
    return {
      address: t.contractAddress,
      symbol: meta.symbol,
      name: meta.name,
      decimals: meta.decimals,
      balance,
      logo: meta.logo,
    };
  }).filter(t => t.balance > 0);

  return {
    chain,
    address,
    nativeBalance,
    nativeSymbol: CHAIN_NATIVE[chain],
    nativeUsd: nativeBalance * nativePriceUsd,
    txCount: txCountVal,
    tokens,
    recentTransactions,
    explorerUrl: `${CHAIN_EXPLORER[chain]}/address/${address}`,
  };
}
