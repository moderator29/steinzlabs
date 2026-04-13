import 'server-only';
import { cache, TTL } from '../api/cache-manager';

// ─── Chain Configuration ───────────────────────────────────────────────────────

const CHAIN_APIS: Record<string, { base: string; key: string }> = {
  ethereum:  { base: 'https://api.etherscan.io/api',               key: process.env.ETHERSCAN_API_KEY ?? 'YourApiKeyToken' },
  bsc:       { base: 'https://api.bscscan.com/api',                key: process.env.BSCSCAN_API_KEY ?? process.env.ETHERSCAN_API_KEY ?? 'YourApiKeyToken' },
  polygon:   { base: 'https://api.polygonscan.com/api',            key: process.env.POLYGONSCAN_API_KEY ?? process.env.ETHERSCAN_API_KEY ?? 'YourApiKeyToken' },
  arbitrum:  { base: 'https://api.arbiscan.io/api',                key: process.env.ARBISCAN_API_KEY ?? process.env.ETHERSCAN_API_KEY ?? 'YourApiKeyToken' },
  base:      { base: 'https://api.basescan.org/api',               key: process.env.BASESCAN_API_KEY ?? process.env.ETHERSCAN_API_KEY ?? 'YourApiKeyToken' },
  optimism:  { base: 'https://api-optimistic.etherscan.io/api',    key: process.env.OPTIMISM_API_KEY ?? process.env.ETHERSCAN_API_KEY ?? 'YourApiKeyToken' },
  avalanche: { base: 'https://api.snowtrace.io/api',               key: process.env.SNOWTRACE_API_KEY ?? 'YourApiKeyToken' },
};

function chainConfig(chain: string) {
  return CHAIN_APIS[chain.toLowerCase()] ?? CHAIN_APIS.ethereum;
}

async function ethscan<T>(chain: string, params: Record<string, string>): Promise<T> {
  const cfg = chainConfig(chain);
  const qs = new URLSearchParams({ ...params, apikey: cfg.key }).toString();
  const res = await fetch(`${cfg.base}?${qs}`, {
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Etherscan ${chain} → ${res.status}`);
  const json = await res.json() as { status: string; message: string; result: T };
  if (json.status === '0' && json.message !== 'No transactions found') {
    throw new Error(`Etherscan: ${json.message}`);
  }
  return json.result;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ContractSource {
  sourceCode: string;
  abi: string;
  contractName: string;
  compilerVersion: string;
  optimizationUsed: string;
  runs: string;
  constructorArguments: string;
  licenseType: string;
  verified: boolean;
  isProxy: boolean;
  implementation: string | null;  // For proxies
}

export interface ContractCreation {
  contractAddress: string;
  creatorAddress: string;
  txHash: string;
  blockNumber: string;
  timestamp: string | null;
}

export interface ERC20TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  divisor: string;
}

// ─── getContractSource ─────────────────────────────────────────────────────────

export async function getContractSource(
  address: string,
  chain = 'ethereum'
): Promise<ContractSource | null> {
  const key = `etherscan:source:${chain}:${address.toLowerCase()}`;
  const hit = cache.get<ContractSource>(key);
  if (hit) return hit;

  try {
    type SourceRow = {
      SourceCode: string; ABI: string; ContractName: string;
      CompilerVersion: string; OptimizationUsed: string; Runs: string;
      ConstructorArguments: string; LicenseType: string;
      Proxy: string; Implementation: string;
    };
    const rows = await ethscan<SourceRow[]>(chain, {
      module: 'contract', action: 'getsourcecode', address,
    });
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    const verified = r.ABI !== 'Contract source code not verified';
    const result: ContractSource = {
      sourceCode: r.SourceCode,
      abi: verified ? r.ABI : '',
      contractName: r.ContractName || '',
      compilerVersion: r.CompilerVersion || '',
      optimizationUsed: r.OptimizationUsed,
      runs: r.Runs,
      constructorArguments: r.ConstructorArguments,
      licenseType: r.LicenseType || 'Unknown',
      verified,
      isProxy: r.Proxy === '1',
      implementation: r.Implementation || null,
    };
    // Cache verified info for 24h, unverified for 5 min
    cache.set(key, result, verified ? TTL.ENTITY_LABEL : TTL.TOKEN_SECURITY);
    return result;
  } catch {
    return null;
  }
}

// ─── getContractCreation ───────────────────────────────────────────────────────

export async function getContractCreation(
  address: string,
  chain = 'ethereum'
): Promise<ContractCreation | null> {
  const key = `etherscan:creation:${chain}:${address.toLowerCase()}`;
  const hit = cache.get<ContractCreation>(key);
  if (hit) return hit;

  try {
    type CreationRow = {
      contractAddress: string;
      contractCreator: string;
      txHash: string;
    };
    const rows = await ethscan<CreationRow[]>(chain, {
      module: 'contract', action: 'getcontractcreation',
      contractaddresses: address,
    });
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    const result: ContractCreation = {
      contractAddress: r.contractAddress,
      creatorAddress: r.contractCreator,
      txHash: r.txHash,
      blockNumber: '',
      timestamp: null,
    };
    cache.set(key, result, TTL.ENTITY_LABEL);
    return result;
  } catch {
    return null;
  }
}

// ─── getERC20TokenInfo ─────────────────────────────────────────────────────────

export async function getERC20TokenInfo(
  address: string,
  chain = 'ethereum'
): Promise<ERC20TokenInfo | null> {
  const key = `etherscan:tokeninfo:${chain}:${address.toLowerCase()}`;
  const hit = cache.get<ERC20TokenInfo>(key);
  if (hit) return hit;

  try {
    type TokenRow = {
      tokenName: string; symbol: string; decimals: string;
      totalSupply: string; divisor: string;
    };
    const rows = await ethscan<TokenRow[]>(chain, {
      module: 'token', action: 'tokeninfo', contractaddress: address,
    });
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    const result: ERC20TokenInfo = {
      name: r.tokenName || '',
      symbol: r.symbol || '',
      decimals: parseInt(r.decimals || '18'),
      totalSupply: r.totalSupply || '0',
      divisor: r.divisor || '1',
    };
    cache.set(key, result, TTL.MARKET_CAP);
    return result;
  } catch {
    return null;
  }
}

// ─── getTopERC20Holders ────────────────────────────────────────────────────────
// Uses Ethplorer (free, reliable) — Etherscan pro-tier required for holders API

export interface EthplorerHolder {
  address: string;
  balance: number;
  share: number;   // percentage 0-100
}

export async function getTopERC20Holders(
  address: string,
  limit = 20
): Promise<EthplorerHolder[]> {
  const key = `ethplorer:holders:${address.toLowerCase()}:${limit}`;
  const hit = cache.get<EthplorerHolder[]>(key);
  if (hit) return hit;

  try {
    const apiKey = process.env.ETHPLORER_API_KEY || 'freekey';
    const res = await fetch(
      `https://api.ethplorer.io/getTopTokenHolders/${address}?limit=${limit}&apiKey=${apiKey}`,
      { signal: AbortSignal.timeout(10_000), next: { revalidate: 120 } }
    );
    if (!res.ok) return [];
    const data = await res.json() as { holders?: EthplorerHolder[] };
    const holders = data.holders ?? [];
    cache.set(key, holders, TTL.HOLDER_DATA);
    return holders;
  } catch {
    return [];
  }
}
