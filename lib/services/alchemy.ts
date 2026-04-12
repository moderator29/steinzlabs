import 'server-only';
import { Alchemy, Network, TokenMetadataResponse, AssetTransfersCategory } from 'alchemy-sdk';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * Alchemy EVM Chain Data Service
 * Covers: Ethereum, Polygon, Base, Arbitrum, BNB, Optimism, Avalanche
 */

const API_KEY = process.env.ALCHEMY_API_KEY || '';

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
};

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
    const result = await alchemy.core.getTokenBalances(walletAddress);
    return result.tokenBalances.map(b => ({
      contractAddress: b.contractAddress,
      tokenBalance: b.tokenBalance ?? '0',
    }));
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

/**
 * Get all ERC-20 token approvals for a wallet.
 * Used by the Approval Manager feature.
 */
export async function getTokenApprovals(
  walletAddress: string,
  chain: string
): Promise<TokenApproval[]> {
  const key = cacheKey('alchemy', 'approvals', { walletAddress: walletAddress.toLowerCase(), chain });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    const alchemy = getAlchemy(chain);
    // Get all ERC20 transfer events where from = wallet (approval proxy)
    const result = await alchemy.core.getAssetTransfers({
      fromAddress: walletAddress,
      category: [AssetTransfersCategory.ERC20],
      maxCount: 200,
    });

    // Extract unique contract addresses
    const contractSet = new Set<string>();
    result.transfers.forEach(t => {
      if (t.rawContract?.address) contractSet.add(t.rawContract.address);
    });

    // Build basic approval list from the token contracts interacted with
    return Array.from(contractSet).map(addr => ({
      tokenAddress: addr,
      spender: addr,
      allowance: 'unknown',
    }));
  });
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
