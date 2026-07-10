import 'server-only';
import { Alchemy, Network, TokenMetadataResponse, AssetTransfersCategory, TokenBalanceType } from 'alchemy-sdk';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';
import { normalizeChainId } from '../chains/chainMeta';
import { getEvmRpcUrl } from '../chains/evmRpc';

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

// EVM chains Alchemy serves over HTTP but the alchemy-sdk `Network` enum has
// no entry for yet (e.g. Robinhood Chain). We reach them via the SDK's `url`
// override so eth_* + enhanced APIs hit the RIGHT chain instead of silently
// falling back to Ethereum mainnet. Values are canonical chain ids.
const SDK_URL_OVERRIDE_CHAINS = new Set<string>(['robinhood']);

/** Returns true if the chain name is supported by Alchemy. */
function isAlchemySupported(chain: string): boolean {
  return chain.toLowerCase() in NETWORK_MAP;
}

// Cache Alchemy client instances per network / url-override chain
const clients = new Map<string, Alchemy>();

function getAlchemy(chain: string): Alchemy {
  const c = chain.toLowerCase();
  const network = NETWORK_MAP[c];
  if (network) {
    if (!clients.has(network)) {
      clients.set(network, new Alchemy({ apiKey: API_KEY, network }));
    }
    return clients.get(network)!;
  }

  // Chain not in the SDK enum but reachable via a known endpoint — point the
  // SDK at it with a `url` override (native balance works even with no key via
  // the public RPC fallback; enhanced APIs need the Alchemy endpoint).
  const canonical = normalizeChainId(c);
  if (SDK_URL_OVERRIDE_CHAINS.has(canonical)) {
    const url = getEvmRpcUrl(canonical);
    const key = `url:${canonical}`;
    if (url && !clients.has(key)) {
      clients.set(key, new Alchemy({ apiKey: API_KEY, network: Network.ETH_MAINNET, url }));
    }
    if (clients.has(key)) return clients.get(key)!;
  }

  // Unknown chain — preserve legacy behavior (Ethereum mainnet default).
  if (!clients.has(Network.ETH_MAINNET)) {
    clients.set(Network.ETH_MAINNET, new Alchemy({ apiKey: API_KEY, network: Network.ETH_MAINNET }));
  }
  return clients.get(Network.ETH_MAINNET)!;
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
      // Request block timestamps so callers can derive first-seen/last-active
      // and show real transaction times (was missing → EVM wallets showed null).
      withMetadata: true,
    };
    const result = await alchemy.core.getAssetTransfers(params);
    return result.transfers.map(t => {
      const meta = (t as { metadata?: { blockTimestamp?: string } }).metadata;
      const tsMs = meta?.blockTimestamp ? new Date(meta.blockTimestamp).getTime() : NaN;
      return {
        hash: t.hash,
        from: t.from,
        to: t.to ?? '',
        value: String(t.value ?? 0),
        asset: t.asset ?? '',
        blockNum: t.blockNum,
        timestamp: Number.isFinite(tsMs) ? Math.floor(tsMs / 1000) : undefined,
      };
    });
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

// ERC-20 ABI fragments — only what we need for allowance queries
const ERC20_ALLOWANCE_SELECTOR = '0xdd62ed3e'; // allowance(address,address)
const ERC20_BALANCEOF_SELECTOR = '0x70a08231'; // balanceOf(address)
// keccak256("Approval(address,address,uint256)")
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

/** Run an array of async tasks with a bounded concurrency pool. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Current best block height for the chain (hex 0x..., for getLogs ranges). */
export async function getBlockNumber(chain: string): Promise<number> {
  const alchemy = getAlchemy(chain);
  return withAlchemyRetry(() => alchemy.core.getBlockNumber());
}

export interface ResolvedApproval extends TokenApproval {
  /** Raw on-chain balance of the token held by the owner (base units). */
  balanceRaw: string;
}

/**
 * Discover the set of ERC-20 token contracts a wallet has ever interacted with,
 * by paginating Alchemy asset-transfer history in BOTH directions. This is the
 * cheap, range-safe way to bound the (otherwise unbounded) Approval-log scan:
 * a wallet can only hold an approval on a token it has touched.
 */
async function discoverErc20Contracts(
  alchemy: Alchemy,
  owner: string,
  maxPages = 10,
): Promise<Set<string>> {
  const contracts = new Set<string>();
  for (const dir of ['from', 'to'] as const) {
    let pageKey: string | undefined;
    let pages = 0;
    do {
      const res = await withAlchemyRetry(() => alchemy.core.getAssetTransfers({
        [dir === 'from' ? 'fromAddress' : 'toAddress']: owner,
        category: [AssetTransfersCategory.ERC20],
        maxCount: 1000,
        excludeZeroValue: false,
        ...(pageKey ? { pageKey } : {}),
      }));
      for (const t of res.transfers) {
        const c = (t.rawContract?.address ?? '').toLowerCase();
        if (/^0x[0-9a-f]{40}$/.test(c)) contracts.add(c);
      }
      pageKey = (res as unknown as { pageKey?: string }).pageKey;
      pages++;
    } while (pageKey && pages < maxPages);
  }
  return contracts;
}

/**
 * Get all live ERC-20 token approvals for a wallet across an EVM chain.
 *
 * Strategy (the old fromBlock:0x0→latest single getLogs timed out / failed on
 * active wallets): first enumerate every ERC-20 contract the wallet ever touched
 * via paginated getAssetTransfers, then scan Approval(owner=wallet) logs PER
 * TOKEN with a bounded-concurrency pool. Token-scoped getLogs is cheap and does
 * not blow the provider's range/result caps, so it returns real approvals fast.
 * Finally resolve the CURRENT allowance() (+ owner balanceOf) for each unique
 * (token, spender) pair and drop anything already revoked to zero.
 */
export async function getTokenApprovals(
  walletAddress: string,
  chain: string
): Promise<ResolvedApproval[]> {
  if (!isAlchemySupported(chain)) {
    throw new Error(`Chain '${chain}' is not supported by Alchemy SDK`);
  }
  const key = cacheKey('alchemy', 'approvals', { walletAddress: walletAddress.toLowerCase(), chain });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    const alchemy = getAlchemy(chain);
    const owner = walletAddress.toLowerCase();
    const ownerPadded = '0x000000000000000000000000' + owner.replace('0x', '');

    // 1. Which ERC-20 contracts has this wallet ever touched?
    const contracts = await discoverErc20Contracts(alchemy, owner);
    if (contracts.size === 0) return [];

    // 2. Per-token Approval-log scan (bounded concurrency). Filtering by the
    //    token address keeps each getLogs cheap and well within range caps.
    const pairMap = new Map<string, { tokenAddress: string; spender: string }>();
    await mapWithConcurrency(Array.from(contracts), 8, async (tokenAddress) => {
      try {
        const logs = await withAlchemyRetry(() => alchemy.core.getLogs({
          address: tokenAddress,
          fromBlock: '0x0',
          toBlock: 'latest',
          topics: [APPROVAL_TOPIC, ownerPadded],
        }));
        for (const log of logs) {
          if (!log.address || !log.topics?.[2]) continue;
          const token = log.address.toLowerCase();
          const spender = '0x' + log.topics[2].slice(26).toLowerCase();
          pairMap.set(`${token}:${spender}`, { tokenAddress: token, spender });
        }
      } catch {
        /* token-scoped scan failed — skip this token, keep the rest */
      }
    });

    if (pairMap.size === 0) return [];

    // 3. Resolve CURRENT allowance + owner balance for each pair (bounded pool).
    const ownerEncoded = owner.replace('0x', '').padStart(64, '0');
    const resolved = await mapWithConcurrency(
      Array.from(pairMap.values()),
      10,
      async ({ tokenAddress, spender }): Promise<ResolvedApproval> => {
        const spenderEncoded = spender.replace('0x', '').padStart(64, '0');
        const [allowanceRes, balanceRes] = await Promise.allSettled([
          withAlchemyRetry(() => alchemy.core.call({
            to: tokenAddress,
            data: ERC20_ALLOWANCE_SELECTOR + ownerEncoded + spenderEncoded,
          })),
          withAlchemyRetry(() => alchemy.core.call({
            to: tokenAddress,
            data: ERC20_BALANCEOF_SELECTOR + ownerEncoded,
          })),
        ]);
        let allowance = 'unknown';
        if (allowanceRes.status === 'fulfilled') {
          const hex = allowanceRes.value;
          try { allowance = hex && hex !== '0x' ? BigInt(hex).toString() : '0'; } catch { allowance = 'unknown'; }
        }
        let balanceRaw = '0';
        if (balanceRes.status === 'fulfilled') {
          const hex = balanceRes.value;
          try { balanceRaw = hex && hex !== '0x' ? BigInt(hex).toString() : '0'; } catch { balanceRaw = '0'; }
        }
        return { tokenAddress, spender, allowance, balanceRaw };
      },
    );

    // Drop fully-revoked approvals; keep 'unknown' (call reverted) so the user
    // still sees the grant rather than silently hiding it.
    return resolved.filter(a => a.allowance !== '0');
  });
}

// ─── Permit2 allowances ─────────────────────────────────────────────────────
// Uniswap's Permit2 is a single canonical contract deployed at the SAME address
// on every EVM chain. Once a wallet grants Permit2 an ERC-20 approval, Permit2
// holds a SECOND, independent allowance ledger: allowance(owner, token, spender)
// → (uint160 amount, uint48 expiration, uint48 nonce). A live Permit2 grant to a
// spender is spendable even if the underlying ERC-20 approval looks routine, so
// we surface it as a first-class approval the user can revoke.

const PERMIT2_CONTRACT = '0x000000000022d473030f116ddee9f6b43ac78ba3';
// keccak256("Approval(address,address,address,uint160,uint48)")
const PERMIT2_APPROVAL_TOPIC = '0xda9fa7c1b00402c17d0161b249b1ab8bbec047c5a52207b9c112deffd817036b';
// keccak256("Permit(address,address,address,uint160,uint48,uint48)")
const PERMIT2_PERMIT_TOPIC = '0xc6a377bfc4eb120024a8ac08eef205be16b817020812c73223e81d1bdb9708ec';
// allowance(address owner,address token,address spender) → (uint160,uint48,uint48)
const PERMIT2_ALLOWANCE_SELECTOR = '0x927da105';
// approve(address token,address spender,uint160 amount,uint48 expiration)
const PERMIT2_APPROVE_SELECTOR = '0x87517c45';
// lockdown((address token,address spender)[]) — Permit2 batch-revoke entrypoint
const PERMIT2_LOCKDOWN_SELECTOR = '0xcc53287f';

/** A live Permit2 (token, spender) allowance for the wallet. */
export interface Permit2Allowance {
  tokenAddress: string;
  spender: string;
  /** uint160 amount, base units, as a decimal string. */
  amount: string;
  /** uint48 unix expiration; 0 = no live time-bound (treat as expired/unset). */
  expiration: number;
  /** Owner ERC-20 balance of the token (base units), for USD-at-risk capping. */
  balanceRaw: string;
}

/**
 * Discover and resolve every LIVE Permit2 allowance for a wallet.
 *
 * We scan Permit2's own Approval + Permit logs filtered to owner (topic[1]),
 * collect the (token, spender) pairs, then read the CURRENT
 * allowance(owner, token, spender) on the Permit2 contract. A grant is live only
 * when amount > 0 AND expiration is in the future (Permit2 allowances are
 * time-bounded, unlike ERC-20). Anything expired or zeroed is dropped.
 */
export async function getPermit2Approvals(
  walletAddress: string,
  chain: string,
): Promise<Permit2Allowance[]> {
  if (!isAlchemySupported(chain)) {
    throw new Error(`Chain '${chain}' is not supported by Alchemy SDK`);
  }
  const key = cacheKey('alchemy', 'permit2', { walletAddress: walletAddress.toLowerCase(), chain });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    const alchemy = getAlchemy(chain);
    const owner = walletAddress.toLowerCase();
    const ownerPadded = '0x000000000000000000000000' + owner.replace('0x', '');
    const nowSec = Math.floor(Date.now() / 1000);

    // 1. Owner-indexed Permit2 Approval + Permit logs → (token, spender) pairs.
    const pairMap = new Map<string, { tokenAddress: string; spender: string }>();
    for (const topic of [PERMIT2_APPROVAL_TOPIC, PERMIT2_PERMIT_TOPIC]) {
      try {
        const logs = await withAlchemyRetry(() => alchemy.core.getLogs({
          address: PERMIT2_CONTRACT,
          fromBlock: '0x0',
          toBlock: 'latest',
          topics: [topic, ownerPadded],
        }));
        for (const log of logs) {
          // topics: [sig, owner, token, spender]
          if (!log.topics?.[2] || !log.topics?.[3]) continue;
          const token = '0x' + log.topics[2].slice(26).toLowerCase();
          const spender = '0x' + log.topics[3].slice(26).toLowerCase();
          pairMap.set(`${token}:${spender}`, { tokenAddress: token, spender });
        }
      } catch {
        /* Permit2 log scan failed for this topic — keep the other */
      }
    }
    if (pairMap.size === 0) return [];

    // 2. Resolve CURRENT Permit2 allowance() + owner ERC-20 balance per pair.
    const ownerEncoded = owner.replace('0x', '').padStart(64, '0');
    const resolved = await mapWithConcurrency(
      Array.from(pairMap.values()),
      10,
      async ({ tokenAddress, spender }): Promise<Permit2Allowance | null> => {
        const tokenEncoded = tokenAddress.replace('0x', '').padStart(64, '0');
        const spenderEncoded = spender.replace('0x', '').padStart(64, '0');
        const [allowanceRes, balanceRes] = await Promise.allSettled([
          withAlchemyRetry(() => alchemy.core.call({
            to: PERMIT2_CONTRACT,
            data: PERMIT2_ALLOWANCE_SELECTOR + ownerEncoded + tokenEncoded + spenderEncoded,
          })),
          withAlchemyRetry(() => alchemy.core.call({
            to: tokenAddress,
            data: ERC20_BALANCEOF_SELECTOR + ownerEncoded,
          })),
        ]);

        if (allowanceRes.status !== 'fulfilled') return null;
        const hex = allowanceRes.value;
        if (!hex || hex === '0x') return null;
        // Return is three 32-byte words: amount (uint160), expiration, nonce.
        const body = hex.replace(/^0x/, '');
        if (body.length < 192) return null;
        let amount: bigint;
        let expiration: number;
        try {
          amount = BigInt('0x' + body.slice(0, 64));
          expiration = Number(BigInt('0x' + body.slice(64, 128)));
        } catch {
          return null;
        }
        // Live only: non-zero amount AND a future expiration. A zero expiration
        // is Permit2's "already expired" sentinel, so we drop it too.
        if (amount === BigInt(0) || expiration <= nowSec) return null;

        let balanceRaw = '0';
        if (balanceRes.status === 'fulfilled') {
          const b = balanceRes.value;
          try { balanceRaw = b && b !== '0x' ? BigInt(b).toString() : '0'; } catch { balanceRaw = '0'; }
        }
        return { tokenAddress, spender, amount: amount.toString(), expiration, balanceRaw };
      },
    );

    return resolved.filter((a): a is Permit2Allowance => a !== null);
  });
}

/** Build Permit2 approve(token, spender, 0, 0) calldata to revoke one grant. */
export function buildPermit2RevokeCalldata(token: string, spender: string): string {
  const t = token.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  const s = spender.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  // amount = 0 (uint160), expiration = 0 (uint48) → fully zeroed grant.
  return PERMIT2_APPROVE_SELECTOR + t + s + '0'.repeat(64) + '0'.repeat(64);
}

// ─── NFT operator approvals (ERC-721 / ERC-1155 setApprovalForAll) ──────────
// keccak256("ApprovalForAll(address,address,bool)")
const APPROVAL_FOR_ALL_TOPIC = '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31';
// setApprovalForAll(address operator,bool approved)
const SET_APPROVAL_FOR_ALL_SELECTOR = '0xa22cb465';
// isApprovedForAll(address owner,address operator) → bool
const IS_APPROVED_FOR_ALL_SELECTOR = '0xe985e9c5';

/** A live NFT operator (setApprovalForAll) grant for the wallet. */
export interface NftOperatorApproval {
  /** The NFT collection contract (ERC-721 or ERC-1155). */
  collection: string;
  /** The operator granted transfer rights over the whole collection. */
  operator: string;
  /** Collection name/symbol when Alchemy has metadata, else null. */
  name: string | null;
  symbol: string | null;
  logo: string | null;
  /** ERC-721 | ERC-1155 | UNKNOWN per Alchemy contract metadata. */
  tokenType: string;
  /** How many NFTs of this collection the owner currently holds (exposure). */
  ownedCount: number | null;
  /** Floor price in native token (ETH-equivalent) when Alchemy has it, else null. */
  floorNative: number | null;
}

/**
 * Discover and resolve every LIVE ERC-721 / ERC-1155 setApprovalForAll operator
 * grant for a wallet. Operator approvals are the NFT-drainer vector: one
 * setApprovalForAll lets a contract move EVERY token in a collection.
 *
 * Strategy mirrors the ERC-20 scan: enumerate the wallet's ApprovalForAll logs
 * (owner-indexed via topic[1]) to collect (collection, operator) pairs, then
 * read the CURRENT isApprovedForAll(owner, operator) on-chain and drop anything
 * already revoked. Enrich live grants with collection metadata + owned count.
 */
export async function getNftApprovals(
  walletAddress: string,
  chain: string,
): Promise<NftOperatorApproval[]> {
  if (!isAlchemySupported(chain)) {
    throw new Error(`Chain '${chain}' is not supported by Alchemy SDK`);
  }
  const key = cacheKey('alchemy', 'nft_approvals', { walletAddress: walletAddress.toLowerCase(), chain });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    const alchemy = getAlchemy(chain);
    const owner = walletAddress.toLowerCase();
    const ownerPadded = '0x000000000000000000000000' + owner.replace('0x', '');

    // 1. All ApprovalForAll(owner=wallet) logs across every collection.
    //    Not filtered by collection address, so it's a single owner-scoped scan
    //    (ApprovalForAll is rare per wallet — the result set stays small).
    let logs: Awaited<ReturnType<typeof alchemy.core.getLogs>> = [];
    try {
      logs = await withAlchemyRetry(() => alchemy.core.getLogs({
        fromBlock: '0x0',
        toBlock: 'latest',
        topics: [APPROVAL_FOR_ALL_TOPIC, ownerPadded],
      }));
    } catch {
      return [];
    }

    const pairMap = new Map<string, { collection: string; operator: string }>();
    for (const log of logs) {
      if (!log.address || !log.topics?.[2]) continue;
      const collection = log.address.toLowerCase();
      const operator = '0x' + log.topics[2].slice(26).toLowerCase();
      pairMap.set(`${collection}:${operator}`, { collection, operator });
    }
    if (pairMap.size === 0) return [];

    // 2. Resolve CURRENT isApprovedForAll per pair; drop revoked grants.
    const ownerEncoded = owner.replace('0x', '').padStart(64, '0');
    const resolved = await mapWithConcurrency(
      Array.from(pairMap.values()),
      10,
      async ({ collection, operator }): Promise<NftOperatorApproval | null> => {
        const operatorEncoded = operator.replace('0x', '').padStart(64, '0');
        let approved = false;
        try {
          const res = await withAlchemyRetry(() => alchemy.core.call({
            to: collection,
            data: IS_APPROVED_FOR_ALL_SELECTOR + ownerEncoded + operatorEncoded,
          }));
          approved = !!res && res !== '0x' && BigInt(res) !== BigInt(0);
        } catch {
          // Call reverted (e.g. self-destructed collection) — treat as not live.
          return null;
        }
        if (!approved) return null;

        // Metadata + owner exposure are best-effort enrichment.
        let name: string | null = null;
        let symbol: string | null = null;
        let logo: string | null = null;
        let tokenType = 'UNKNOWN';
        let floorNative: number | null = null;
        let ownedCount: number | null = null;
        try {
          const md = await withAlchemyRetry(() => alchemy.nft.getContractMetadata(collection));
          name = md.name ?? null;
          symbol = md.symbol ?? null;
          tokenType = md.tokenType ?? 'UNKNOWN';
          logo = (md as { openSeaMetadata?: { imageUrl?: string } }).openSeaMetadata?.imageUrl ?? null;
          const floor = (md as { openSeaMetadata?: { floorPrice?: number } }).openSeaMetadata?.floorPrice;
          floorNative = typeof floor === 'number' && floor > 0 ? floor : null;
        } catch {
          /* metadata best-effort */
        }
        try {
          const owned = await withAlchemyRetry(() => alchemy.nft.getNftsForOwner(owner, {
            contractAddresses: [collection],
            omitMetadata: true,
            pageSize: 100,
          }));
          ownedCount = owned.totalCount ?? owned.ownedNfts?.length ?? null;
        } catch {
          /* count best-effort */
        }

        return { collection, operator, name, symbol, logo, tokenType, ownedCount, floorNative };
      },
    );

    return resolved.filter((a): a is NftOperatorApproval => a !== null);
  });
}

/** Build setApprovalForAll(operator, false) calldata to revoke an NFT operator. */
export function buildNftRevokeCalldata(operator: string): string {
  const op = operator.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  return SET_APPROVAL_FOR_ALL_SELECTOR + op + '0'.repeat(64); // approved = false
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

// ─── Pre-sign asset-diff simulation (alchemy_simulateAssetChanges) ─────────────

/** Per-asset change row from alchemy_simulateAssetChanges. */
export interface SimAssetChange {
  assetType: string;
  changeType: 'TRANSFER' | 'APPROVE' | string;
  /** Sign relative to `from`: negative = leaving the wallet, positive = arriving. */
  direction: 'in' | 'out' | 'approve';
  from: string;
  to: string;
  rawAmount: string;
  amount: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  contractAddress: string | null;
  logo: string | null;
}

export interface AssetChangesSimulation {
  available: true;
  changes: SimAssetChange[];
  gasUsed: string | null;
  /** Top-level revert/error surfaced by the simulator, if any. */
  error: string | null;
}

export interface AssetChangesUnavailable {
  available: false;
  reason: string;
}

const ALCHEMY_HTTP: Record<string, string | undefined> = {
  ethereum: 'eth-mainnet',
  eth: 'eth-mainnet',
  polygon: 'polygon-mainnet',
  matic: 'polygon-mainnet',
  base: 'base-mainnet',
  arbitrum: 'arb-mainnet',
  arb: 'arb-mainnet',
  optimism: 'opt-mainnet',
  op: 'opt-mainnet',
  bsc: 'bnb-mainnet',
  bnb: 'bnb-mainnet',
  avalanche: 'avax-mainnet',
  avax: 'avax-mainnet',
  // Robinhood Chain (Arbitrum-Orbit L2, native ETH, chain id 4663).
  robinhood: 'robinhood-mainnet',
};

/**
 * Pre-sign asset-diff via the raw `alchemy_simulateAssetChanges` JSON-RPC
 * method (richer than the SDK wrapper — includes APPROVE change types, which
 * is exactly what Signature Insight needs to flag hidden approvals). Returns
 * an honest `available:false` state when the key is unset, the chain is
 * unsupported, or the simulator errors. Never fabricates a result.
 */
export async function simulateAssetChangesRpc(
  chain: string,
  tx: { from: string; to: string; data: string; value?: string }
): Promise<AssetChangesSimulation | AssetChangesUnavailable> {
  if (!API_KEY) return { available: false, reason: 'Simulation key not configured' };
  const subdomain = ALCHEMY_HTTP[chain.toLowerCase()];
  if (!subdomain) return { available: false, reason: `Chain '${chain}' not supported for simulation` };

  const url = `https://${subdomain}.g.alchemy.com/v2/${API_KEY}`;
  const params: Record<string, string> = { from: tx.from, to: tx.to, data: tx.data };
  if (tx.value && tx.value !== '0') {
    params.value = tx.value.startsWith('0x')
      ? tx.value
      : '0x' + BigInt(tx.value).toString(16);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_simulateAssetChanges',
        params: [params],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { available: false, reason: `Simulation upstream ${res.status}` };
    const json = await res.json() as {
      result?: {
        changes?: Array<Record<string, unknown>>;
        gasUsed?: string;
        error?: { message?: string } | string | null;
      };
      error?: { message?: string };
    };
    if (json.error) return { available: false, reason: json.error.message || 'Simulation error' };
    const result = json.result;
    if (!result) return { available: false, reason: 'Empty simulation result' };

    const fromLc = tx.from.toLowerCase();
    const changes: SimAssetChange[] = (result.changes ?? []).map((c) => {
      const cFrom = String(c.from ?? '');
      const changeType = String(c.changeType ?? '');
      let direction: SimAssetChange['direction'] = 'in';
      if (changeType === 'APPROVE') direction = 'approve';
      else direction = cFrom.toLowerCase() === fromLc ? 'out' : 'in';
      return {
        assetType: String(c.assetType ?? ''),
        changeType,
        direction,
        from: cFrom,
        to: String(c.to ?? ''),
        rawAmount: String(c.rawAmount ?? ''),
        amount: String(c.amount ?? ''),
        symbol: c.symbol != null ? String(c.symbol) : null,
        name: c.name != null ? String(c.name) : null,
        decimals: typeof c.decimals === 'number' ? c.decimals : null,
        contractAddress: c.contractAddress != null ? String(c.contractAddress) : null,
        logo: c.logo != null ? String(c.logo) : null,
      };
    });

    const errVal = result.error;
    const errMsg = typeof errVal === 'string' ? errVal : errVal?.message ?? null;

    return {
      available: true,
      changes,
      gasUsed: result.gasUsed ?? null,
      error: errMsg,
    };
  } catch (err) {
    return {
      available: false,
      reason: isTransientUpstreamError(err) ? 'Simulation temporarily unavailable' : 'Simulation failed',
    };
  }
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
