import 'server-only';
import { scoreDeployerRugHistory, type DeployerToken, type DeployerRugHistory } from '@/lib/security/deployerRugHistory';

/**
 * Deployer-history fetcher — resolves a token's deployer address +
 * the deployer's prior tokens, then runs scoreDeployerRugHistory().
 *
 * EVM: uses Etherscan-family v2 unified API (one endpoint covers
 * Ethereum / BSC / Polygon / Arbitrum / Optimism / Base) with the
 * ETHERSCAN_API_KEY env var. Falls back to a single-call lookup of
 * the contract creator if no prior history is available.
 *
 * Solana: queries Helius DAS for the token's update_authority +
 * lists prior tokens by the same authority.
 *
 * Both paths cache the resulting DeployerRugHistory in
 * deployer_history_cache for 24h.
 */

const TIMEOUT_MS = 10000;
const CACHE_TTL_SEC = 24 * 60 * 60;

type EvmChain = 'ethereum' | 'bsc' | 'polygon' | 'base' | 'arbitrum' | 'optimism' | 'avalanche';
const ETHERSCAN_CHAINID: Record<EvmChain, number> = {
  ethereum: 1, bsc: 56, polygon: 137, base: 8453, arbitrum: 42161, optimism: 10, avalanche: 43114,
};

async function jget<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Naka-Labs-Deployer-Fetcher/1.0', ...(headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchEvmDeployer(chain: EvmChain, token: string): Promise<string | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY ?? '';
  if (!apiKey) return null;
  const chainid = ETHERSCAN_CHAINID[chain];
  const data = await jget<{ status: string; result?: Array<{ contractCreator?: string }> }>(
    `https://api.etherscan.io/v2/api?chainid=${chainid}&module=contract&action=getcontractcreation&contractaddresses=${token}&apikey=${apiKey}`,
  );
  return data?.result?.[0]?.contractCreator ?? null;
}

async function fetchEvmDeployerHistory(chain: EvmChain, deployer: string): Promise<DeployerToken[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY ?? '';
  if (!apiKey) return [];
  const chainid = ETHERSCAN_CHAINID[chain];
  // List ERC-20 token transfers FROM the deployer — every first transfer
  // of a brand-new token is implicitly the deploy reveal.
  const data = await jget<{ status: string; result?: Array<{ contractAddress?: string; tokenSymbol?: string; timeStamp?: string }> }>(
    `https://api.etherscan.io/v2/api?chainid=${chainid}&module=account&action=tokentx&address=${deployer}&page=1&offset=200&sort=asc&apikey=${apiKey}`,
  );
  const byContract = new Map<string, { symbol: string; firstSeenSec: number }>();
  for (const tx of data?.result ?? []) {
    const addr = tx.contractAddress?.toLowerCase();
    if (!addr || byContract.has(addr)) continue;
    byContract.set(addr, {
      symbol: tx.tokenSymbol ?? '',
      firstSeenSec: Number(tx.timeStamp ?? 0),
    });
  }
  // We don't have peak / current mcap from Etherscan alone — leave 0
  // and let the scorer's dead-detection use the flaggedAsRug path.
  // A later pass can enrich with DexScreener for richer mcap data.
  const out: DeployerToken[] = [];
  for (const [addr, info] of byContract) {
    out.push({
      tokenAddress: addr,
      symbol: info.symbol,
      deployedAtSec: info.firstSeenSec,
      peakMcapUsd: 0,
      currentMcapUsd: 0,
    });
  }
  return out;
}

async function fetchSolanaDeployer(token: string): Promise<{ deployer: string | null; history: DeployerToken[] }> {
  const heliusKey = process.env.HELIUS_API_KEY ?? '';
  if (!heliusKey) return { deployer: null, history: [] };
  const meta = await jget<{ result?: { authorities?: Array<{ address?: string; scopes?: string[] }>; updateAuthority?: string } }>(
    `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`,
    {
      'Content-Type': 'application/json',
    },
  ).catch(() => null);
  // POST-shaped fetch — wrap to send the DAS body
  const postRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'asset', method: 'getAsset', params: { id: token } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!postRes || !postRes.ok) return { deployer: null, history: [] };
  const asset = await postRes.json().catch(() => null) as { result?: { authorities?: Array<{ address?: string; scopes?: string[] }> } } | null;
  const updateAuth = asset?.result?.authorities?.find((a) => a.scopes?.includes('full'))?.address
    ?? asset?.result?.authorities?.[0]?.address
    ?? null;
  if (!updateAuth) return { deployer: null, history: [] };
  // History: list assets by the same authority. DAS searchAssets is the canonical path.
  const histRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 'hist', method: 'searchAssets',
      params: { authorityAddress: updateAuth, tokenType: 'fungible', page: 1, limit: 100 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!histRes || !histRes.ok) return { deployer: updateAuth, history: [] };
  const hist = await histRes.json().catch(() => null) as { result?: { items?: Array<{ id: string; content?: { metadata?: { symbol?: string; name?: string } } }> } } | null;
  const history: DeployerToken[] = (hist?.result?.items ?? []).map((it) => ({
    tokenAddress: it.id,
    symbol: it.content?.metadata?.symbol ?? '',
    deployedAtSec: 0, // DAS doesn't return mint timestamp in this shape
    peakMcapUsd: 0,
    currentMcapUsd: 0,
  }));
  // Touch the unused `meta` var so TS doesn't complain about the prep call
  void meta;
  return { deployer: updateAuth, history };
}

export interface DeployerHistoryResult {
  deployer: string;
  history: DeployerRugHistory;
}

// Cheap deployer resolution for EVM chains (single getcontractcreation call),
// so the route can check the per-deployer cache BEFORE running the expensive
// full-history scan. Returns null for chains where resolution isn't cheaply
// separable (e.g. Solana, where resolving already fetches history).
export async function resolveDeployer(chain: string, token: string): Promise<string | null> {
  const lower = chain.toLowerCase();
  if (lower in ETHERSCAN_CHAINID) return fetchEvmDeployer(lower as EvmChain, token);
  return null;
}

// Address-first scoring: caller already has the deployer wallet (not a token),
// so skip the token→creator resolution and score the deployer's full history
// directly. EVM only — Solana resolution is inherently token-first (authority
// is discovered from a mint), so there is no cheap address-first path there.
export async function fetchAndScoreDeployerByAddress(chain: string, deployer: string): Promise<DeployerHistoryResult | null> {
  const lower = chain.toLowerCase();
  if (!(lower in ETHERSCAN_CHAINID)) return null;
  const history = await fetchEvmDeployerHistory(lower as EvmChain, deployer);
  return { deployer, history: scoreDeployerRugHistory(history) };
}

export async function fetchAndScoreDeployerHistory(chain: string, token: string): Promise<DeployerHistoryResult | null> {
  const lower = chain.toLowerCase();
  if (lower === 'solana') {
    const { deployer, history } = await fetchSolanaDeployer(token);
    if (!deployer) return null;
    return { deployer, history: scoreDeployerRugHistory(history) };
  }
  if (lower in ETHERSCAN_CHAINID) {
    const deployer = await fetchEvmDeployer(lower as EvmChain, token);
    if (!deployer) return null;
    const history = await fetchEvmDeployerHistory(lower as EvmChain, deployer);
    return { deployer, history: scoreDeployerRugHistory(history) };
  }
  return null;
}

export const DEPLOYER_CACHE_TTL_SEC = CACHE_TTL_SEC;
