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

    // Paginate through ALL token balances (Alchemy returns ~100 per page)
    do {
      const result = pageKey
        ? await alchemy.core.getTokenBalances(walletAddress, { type: TokenBalanceType.ERC20, pageKey })
        : await alchemy.core.getTokenBalances(walletAddress);

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
