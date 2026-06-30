import 'server-only';
import { Alchemy, Network, TokenMetadataResponse, AssetTransfersCategory, TokenBalanceType } from 'alchemy-sdk';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * Alchemy EVM Chain Data Service
 * Covers: Ethereum, Polygon, Base, Arbitrum, BNB, Optimism, Avalanche
 */

const API_KEY = process.env.ALCHEMY_API_KEY || '';

// Alchemy-supported networks. BSC added in alchemy-sdk v3.3+.
// Avalanche is not supported via Alchemy SDK — callers must use public RPC for that chain.
const NETWORK_MAP: Record<string, Network> = {
  ethereum: Network.ETH_MAINNET,
  eth: Network.ETH_MAINNET,
  polygon: Network.MATIC_MAINNET,
  matic: Network.MATIC_MAINNET,
  base: Network.BASE_MAINNET,
  arbitrum: Network.ARB_MAINNET,
  arb: Network.ARB_MAINNET,
  optimism: Network.OPT_MAINNET,
  op: Network.OPT_MAINNET,
  // BNB chain — supported since alchemy-sdk 3.3
  ...(Network.BNB_MAINNET ? { bsc: Network.BNB_MAINNET, bnb: Network.BNB_MAINNET } : {}),
};

/** Returns true if the chain name is supported by Alchemy. */
function isAlchemySupported(chain: string): boolean {
  return chain.toLowerCase() in NETWORK_MAP;
}

// Cache Alchemy client instances per network
const clients = new Map<string, Alchemy>();

function getAlchemy(chain: string): Alchemy {
  const network = NETWORK_MAP[chain.toLowerCase()] ?? Network.ETH_MAINNET;
  const key = network;
  if (!clients.has(key)) {
    clients.set(key, new Alchemy({ apiKey: API_KEY, network }));
  }
  return clients.get(key)!;
}

/**
 * True when an error is a TRANSIENT upstream/network failure (no HTTP response,
 * timeout, reset, or a 429/5xx) rather than a real bug. The Alchemy SDK surfaces
 * these as ethers `missing response` / `SERVER_ERROR`, which is exactly the
 * cult-refresh-treasury Sentry noise — a dropped JSON-RPC response. Callers can
 * retry on these and treat the final failure as a soft skip, not a page.
 */
export function isTransientUpstreamError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  const code = (err as { code?: string } | null)?.code ?? '';
  return (
    /missing response|timeout|timed out|econnreset|etimedout|enotfound|socket hang up|network|fetch failed|503|502|504|429|too many requests|rate limit/i.test(msg) ||
    ['SERVER_ERROR', 'TIMEOUT', 'NETWORK_ERROR', 'ETIMEDOUT', 'ECONNRESET'].includes(String(code))
  );
}

/**
 * Run an Alchemy SDK call with a small exponential backoff on TRANSIENT
 * upstream errors only. The SDK does not retry a dropped JSON-RPC response, so a
 * single network blip would otherwise bubble up as a hard failure. Non-transient
 * errors (bad address, auth) rethrow immediately so we don't mask real bugs.
 */
async function withAlchemyRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientUpstreamError(err) || i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, 250 * 2 ** i)); // 250ms, 500ms
    }
  }
  throw lastErr;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenBalance {
  contractAddress: string;
  tokenBalance: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logo?: string;
  usdValue?: number;
}

export interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  blockNum: string;
  timestamp?: number;
}

export interface ContractInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  isERC20: boolean;
  isERC721: boolean;
  deployer?: string;
}

export interface TokenApproval {
  tokenAddress: string;
  spender: string;
  allowance: string;
  tokenSymbol?: string;
  tokenName?: string;
}

// ─── Token Data ───────────────────────────────────────────────────────────────

export async function getTokenMetadata(
  contractAddress: string,
  chain: string
): Promise<TokenMetadataResponse> {
  const key = cacheKey('alchemy', 'token_meta', { contractAddress: contractAddress.toLowerCase(), chain });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    const alchemy = getAlchemy(chain);
    return alchemy.core.getTokenMetadata(contractAddress);
  });
}

export async function getTokenBalances(
  walletAddress: string,
  chain: string
): Promise<TokenBalance[]> {
  const key = cacheKey('alchemy', 'balances', { walletAddress: walletAddress.toLowerCase(), chain });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    const alchemy = getAlchemy(chain);
    const allBalances: TokenBalance[] = [];
    let pageKey: string | undefined;

    // Paginate through ALL token balances (Alchemy returns ~100 per page).
    // Each page is retried on transient upstream drops (the "missing response"
    // that was paging cult-refresh-treasury).
    do {
      const result = await withAlchemyRetry(() => (pageKey
        ? alchemy.core.getTokenBalances(walletAddress, { type: TokenBalanceType.ERC20, pageKey })
        : alchemy.core.getTokenBalances(walletAddress)));

      allBalances.push(...result.tokenBalances.map(b => ({
        contractAddress: b.contractAddress,
        tokenBalance: b.tokenBalance ?? '0',
      })));

      pageKey = (result as unknown as { pageKey?: string }).pageKey;
    } while (pageKey);

    return allBalances;
  });
}

export async function getAssetTransfers(
  address: string,
  chain: string,
  direction: 'from' | 'to' = 'from',
  maxCount = 100
): Promise<TokenTransfer[]> {
  const key = cacheKey('alchemy', 'transfers', { address: address.toLowerCase(), chain, direction });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    const alchemy = getAlchemy(chain);
    const params = {
      [direction === 'from' ? 'fromAddress' : 'toAddress']: address,
      category: [
        AssetTransfersCategory.ERC20,
        AssetTransfersCategory.INTERNAL,
        AssetTransfersCategory.EXTERNAL,
      ],
      maxCount,
    };
    const result = await alchemy.core.getAssetTransfers(params);
    return result.transfers.map(t => ({
      hash: t.hash,
      from: t.from,
      to: t.to ?? '',
      value: String(t.value ?? 0),
      asset: t.asset ?? '',
      blockNum: t.blockNum,
    }));
  });
}

export async function getEthBalance(
  address: string,
  chain: string
): Promise<string> {
  const key = cacheKey('alchemy', 'eth_balance', { address: address.toLowerCase(), chain });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    const alchemy = getAlchemy(chain);
    const balance = await alchemy.core.getBalance(address);
    // Convert from BigInt-like to ETH string
    return (Number(balance) / 1e18).toFixed(6);
  });
}

/**
 * NFT ownership check via Alchemy NFT API. Returns true if `owner` holds
 * any token of `contractAddress` on `chain`. Cached briefly because cult
 * gating reads this on every membership refresh.
 */
export async function isHolderOfContract(
  owner: string,
  contractAddress: string,
  chain: string
): Promise<boolean> {
  if (!isAlchemySupported(chain)) return false;
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) return false;
  const key = cacheKey('alchemy', 'nft_owner', {
    owner: owner.toLowerCase(),
    contract: contractAddress.toLowerCase(),
    chain,
  });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const alchemy = getAlchemy(chain);
      const res = await alchemy.nft.getNftsForOwner(owner, {
        contractAddresses: [contractAddress],
        pageSize: 1,
        omitMetadata: true,
      });
      return (res.ownedNfts?.length ?? 0) > 0;
    } catch {
      return false;
    }
  });
}

/**
 * Reverse-resolve an EVM address to its primary ENS name (mainnet). Returns
 * null when the address has no ENS name or the lookup errors. Cached because
 * wallet sign-in reads this once per new wallet.
 */
export async function lookupEnsName(address: string): Promise<string | null> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  const key = cacheKey('alchemy', 'ens_name', { address: address.toLowerCase() });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      const alchemy = getAlchemy('ethereum');
      const name = await alchemy.core.lookupAddress(address);
      return name ?? null;
    } catch {
      return null;
    }
  });
}

export async function getContractCode(
  contractAddress: string,
  chain: string
): Promise<string> {
  if (!isAlchemySupported(chain)) {
    // Chain not supported by Alchemy — throw so callers can use public RPC fallback
    throw new Error(`Chain '${chain}' is not supported by Alchemy SDK`);
  }
  const key = cacheKey('alchemy', 'contract_code', { contractAddress: contractAddress.toLowerCase(), chain });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    const alchemy = getAlchemy(chain);
    return alchemy.core.getCode(contractAddress);
  });
}

export async function getTokenHolderCount(
  contractAddress: string,
  chain: string
): Promise<number> {
  const key = cacheKey('alchemy', 'holder_count', { contractAddress: contractAddress.toLowerCase(), chain });
  return withCache(key, TTL.HOLDER_DATA, async () => {
    const alchemy = getAlchemy(chain);
    const result = await alchemy.core.getTokenBalances(contractAddress);
    return result.tokenBalances.filter(b => b.tokenBalance && b.tokenBalance !== '0').length;
  });
}

// ERC-20 ABI fragment — only what we need for allowance queries
const ERC20_ALLOWANCE_SELECTOR = '0xdd62ed3e'; // allowance(address,address)

/**
 * Get all ERC-20 token approvals for a wallet.
 * Strategy: scan Approval(owner, spender, value) event logs via Alchemy,
 * then call allowance() on each unique (token, spender) pair to get current value.
 */
export async function getTokenApprovals(
  walletAddress: string,
  chain: string
): Promise<TokenApproval[]> {
  if (!isAlchemySupported(chain)) {
    throw new Error(`Chain '${chain}' is not supported by Alchemy SDK`);
  }
  const key = cacheKey('alchemy', 'approvals', { walletAddress: walletAddress.toLowerCase(), chain });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    const alchemy = getAlchemy(chain);
    const owner = walletAddress.toLowerCase();

    // Scan ERC-20 Approval events where owner = walletAddress
    // Topic[0] = keccak256("Approval(address,address,uint256)")
    // Topic[1] = owner (padded to 32 bytes)
    const approvalTopic = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
    const ownerPadded = '0x000000000000000000000000' + owner.replace('0x', '');

    const logs = await alchemy.core.getLogs({
      fromBlock: '0x0',
      toBlock: 'latest',
      topics: [approvalTopic, ownerPadded],
    });

    // Collect unique (tokenAddress, spender) pairs from most recent log per pair
    const pairMap = new Map<string, { tokenAddress: string; spender: string }>();
    for (const log of logs) {
      if (!log.address || !log.topics?.[2]) continue;
      const tokenAddress = log.address.toLowerCase();
      const spender = '0x' + log.topics[2].slice(26).toLowerCase();
      const pairKey = `${tokenAddress}:${spender}`;
      pairMap.set(pairKey, { tokenAddress, spender });
    }

    if (pairMap.size === 0) return [];

    // Query current allowance for each (token, spender) pair in parallel
    const results = await Promise.allSettled(
      Array.from(pairMap.values()).map(async ({ tokenAddress, spender }) => {
        try {
          // ABI-encode allowance(owner, spender) call
          const ownerEncoded = owner.replace('0x', '').padStart(64, '0');
          const spenderEncoded = spender.replace('0x', '').padStart(64, '0');
          const callData = ERC20_ALLOWANCE_SELECTOR + ownerEncoded + spenderEncoded;

          const hex = await alchemy.core.call({ to: tokenAddress, data: callData });
          const allowance = hex && hex !== '0x' ? BigInt(hex).toString() : '0';

          return { tokenAddress, spender, allowance } satisfies TokenApproval;
        } catch {
          return { tokenAddress, spender, allowance: 'unknown' } satisfies TokenApproval;
        }
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<TokenApproval> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(a => a.allowance !== '0'); // Filter out revoked approvals
  });
}

export async function getGasPrice(chain: string): Promise<number> {
  if (!isAlchemySupported(chain)) return 0;
  const alchemy = getAlchemy(chain);
  const gasPrice = await alchemy.core.getGasPrice();
  return Number(gasPrice) / 1e9; // Convert wei → Gwei
}

export async function simulateTransaction(
  chain: string,
  tx: { from: string; to: string; data: string; value?: string }
): Promise<unknown> {
  if (!isAlchemySupported(chain)) {
    throw new Error(`Chain '${chain}' is not supported for simulation`);
  }
  const alchemy = getAlchemy(chain);
  return alchemy.transact.simulateAssetChanges(tx);
}

/**
 * Build a transaction for sending ETH or ERC-20 tokens.
 * Returns raw transaction object for client-side signing.
 */
export async function buildTransferTx(params: {
  from: string;
  to: string;
  valueEth?: string;
  chain: string;
}): Promise<{ to: string; value: string; data: string; chainId: number }> {
  const CHAIN_IDS: Record<string, number> = {
    ethereum: 1, eth: 1,
    polygon: 137, matic: 137,
    base: 8453,
    arbitrum: 42161, arb: 42161,
    optimism: 10, op: 10,
  };
  const chainId = CHAIN_IDS[params.chain.toLowerCase()] ?? 1;
  const valueWei = params.valueEth
    ? '0x' + Math.floor(parseFloat(params.valueEth) * 1e18).toString(16)
    : '0x0';

  return {
    to: params.to,
    value: valueWei,
    data: '0x',
    chainId,
  };
}
