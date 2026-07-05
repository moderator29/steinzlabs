import 'server-only';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * Alchemy Solana Data Service
 * Replaces Helius — all calls go through Alchemy Solana RPC.
 */

const SOLANA_RPC = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC
  || `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`;
const TIMEOUT_MS = 15_000;

async function solanaRpc(method: string, params: unknown): Promise<unknown> {
  const res = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Alchemy Solana RPC error: ${res.status}`);
  const data = await res.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// ─── Types (same exports as old helius.ts) ───────────────────────────────────

export interface SolanaTokenMeta {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isInitialized: boolean;
  logoUrl?: string;
  description?: string;
}

export interface SolanaBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  name?: string;
}

export interface SolanaTransaction {
  signature: string;
  timestamp: number;
  type: string;
  fee: number;
  feePayer: string;
  slot: number;
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  tokenTransfers?: { fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }[];
}

// Keep backward compat alias
export type HeliusTransaction = SolanaTransaction;

export interface SolanaTokenHolder {
  address: string;
  uiAmount: number;
  percentage: number;
}

export interface SolanaTokenMetaBatch {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string | null;
  description: string | null;
}

// Keep backward compat alias
export type HeliusTokenMeta = SolanaTokenMetaBatch;

// ─── API Functions ───────────────────────────────────────────────────────────

export async function getSolanaSOLBalance(address: string): Promise<number> {
  const key = cacheKey('solana', 'sol_balance', { address });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const result = await solanaRpc('getBalance', [address]) as { value: number };
      return (result?.value ?? 0) / 1e9;
    } catch {
      return 0;
    }
  });
}

export interface SolanaStakeAccount {
  stakeAccount: string;
  validator: string | null;       // vote account of the validator
  stakedSol: number;              // delegated SOL (or total lamports if undelegated)
  state: 'active' | 'deactivating' | 'inactive';
  activationEpoch: string | null;
}

const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';
// u64 max = "never deactivating" sentinel Solana uses on active stake.
const U64_MAX = '18446744073709551615';

/**
 * The wallet's REAL native-SOL stake accounts, read straight from the chain via
 * getProgramAccounts on the Stake program, filtered by the withdraw authority
 * (offset 44). Returns [] when the wallet has none or on any RPC error — never
 * fabricates a position. Liquid-staking tokens (JitoSOL/mSOL) are NOT here;
 * those already show as SPL tokens in holdings.
 */
export async function getSolanaStakeAccounts(walletAddress: string): Promise<SolanaStakeAccount[]> {
  if (!walletAddress || walletAddress.startsWith('0x')) return [];
  const key = cacheKey('solana', 'stake_accounts', { address: walletAddress });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const result = await solanaRpc('getProgramAccounts', [
        STAKE_PROGRAM,
        {
          encoding: 'jsonParsed',
          filters: [{ memcmp: { offset: 44, bytes: walletAddress } }],
        },
      ]) as Array<{ pubkey: string; account: { lamports: number; data: { parsed?: { info?: Record<string, unknown> } } } }>;
      if (!Array.isArray(result)) return [];
      const out: SolanaStakeAccount[] = [];
      for (const r of result) {
        const info = r.account?.data?.parsed?.info as { stake?: { delegation?: { voter?: string; stake?: string; activationEpoch?: string; deactivationEpoch?: string } } } | undefined;
        const delegation = info?.stake?.delegation;
        const lamports = Number(r.account?.lamports ?? 0);
        const stakedSol = delegation?.stake ? Number(delegation.stake) / 1e9 : lamports / 1e9;
        const deact = delegation?.deactivationEpoch;
        const state: SolanaStakeAccount['state'] = !delegation ? 'inactive'
          : (deact && deact !== U64_MAX) ? 'deactivating'
          : 'active';
        out.push({
          stakeAccount: r.pubkey,
          validator: delegation?.voter ?? null,
          stakedSol,
          state,
          activationEpoch: delegation?.activationEpoch ?? null,
        });
      }
      return out.sort((a, b) => b.stakedSol - a.stakedSol);
    } catch {
      return [];
    }
  });
}

export async function getSolanaWalletTokens(walletAddress: string): Promise<SolanaBalance[]> {
  const key = cacheKey('solana', 'wallet_tokens', { walletAddress });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

      // Fetch from BOTH SPL Token and Token-2022 programs in parallel
      const [splResult, token2022Result] = await Promise.all([
        solanaRpc('getTokenAccountsByOwner', [
          walletAddress,
          { programId: SPL_TOKEN_PROGRAM },
          { encoding: 'jsonParsed' },
        ]).catch((err) => {
          console.error('[alchemy-solana] SPL token fetch failed:', err?.message ?? err);
          return { value: [] };
        }),
        solanaRpc('getTokenAccountsByOwner', [
          walletAddress,
          { programId: TOKEN_2022_PROGRAM },
          { encoding: 'jsonParsed' },
        ]).catch((err) => {
          console.error('[alchemy-solana] Token-2022 fetch failed:', err?.message ?? err);
          return { value: [] };
        }),
      ]);

      const allAccounts = [
        ...((splResult as { value: unknown[] })?.value ?? []),
        ...((token2022Result as { value: unknown[] })?.value ?? []),
      ];

      // Deduplicate by mint address
      const seen = new Set<string>();
      return allAccounts
        .map((acc: unknown) => {
          const parsed = (acc as Record<string, unknown>).account as Record<string, unknown>;
          const info = ((parsed?.data as Record<string, unknown>)?.parsed as Record<string, unknown>)?.info as Record<string, unknown>;
          const tokenAmount = info?.tokenAmount as Record<string, unknown>;
          return {
            mint: info?.mint as string ?? '',
            amount: tokenAmount?.amount as number ?? 0,
            decimals: tokenAmount?.decimals as number ?? 0,
            uiAmount: tokenAmount?.uiAmount as number ?? 0,
          };
        })
        .filter(b => {
          if (b.uiAmount <= 0 || !b.mint || seen.has(b.mint)) return false;
          seen.add(b.mint);
          return true;
        });
    } catch {
      return [];
    }
  });
}

export async function getSolanaTransactions(
  address: string,
  limit = 100
): Promise<SolanaTransaction[]> {
  const key = cacheKey('solana', 'transactions', { address, limit });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const sigs = await solanaRpc('getSignaturesForAddress', [
        address,
        { limit },
      ]) as Array<{ signature: string; blockTime: number | null; slot: number; err: unknown }>;

      return (sigs ?? []).map(sig => ({
        signature: sig.signature,
        timestamp: sig.blockTime ?? 0,
        type: sig.err ? 'FAILED' : 'UNKNOWN',
        fee: 0,
        feePayer: address,
        slot: sig.slot,
      }));
    } catch {
      return [];
    }
  });
}

export async function getSolanaTokenMeta(mintAddress: string): Promise<SolanaTokenMeta | null> {
  const key = cacheKey('solana', 'token_meta', { mintAddress });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      // Use getAssetsByOwner-style DAS API for metadata
      const result = await solanaRpc('getAsset', { id: mintAddress }) as Record<string, unknown>;
      if (!result) return null;

      const content = result.content as Record<string, unknown> | undefined;
      const metadata = content?.metadata as Record<string, unknown> | undefined;
      const links = content?.links as Record<string, unknown> | undefined;
      const tokenInfo = result.token_info as Record<string, unknown> | undefined;

      return {
        mint: mintAddress,
        name: (metadata?.name as string) || '',
        symbol: (metadata?.symbol as string) || '',
        decimals: (tokenInfo?.decimals as number) ?? 0,
        supply: (tokenInfo?.supply as number) ?? 0,
        mintAuthority: (tokenInfo?.mint_authority as string) || null,
        freezeAuthority: (tokenInfo?.freeze_authority as string) || null,
        isInitialized: true,
        logoUrl: (links?.image as string) || (content?.json_uri as string) || undefined,
        description: (metadata?.description as string) || undefined,
      };
    } catch {
      return null;
    }
  });
}

export async function getSolanaTokenSupply(mintAddress: string): Promise<number> {
  const key = cacheKey('solana', 'supply', { mintAddress });
  return withCache(key, TTL.MARKET_CAP, async () => {
    try {
      const result = await solanaRpc('getTokenSupply', [mintAddress]) as {
        value: { amount: string; decimals: number; uiAmount: number }
      };
      return result?.value?.uiAmount ?? 0;
    } catch {
      return 0;
    }
  });
}

export async function getSolanaTokenHolders(mintAddress: string): Promise<SolanaTokenHolder[]> {
  const key = cacheKey('solana', 'token_holders', { mintAddress });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const result = await solanaRpc('getTokenLargestAccounts', [mintAddress]) as {
        value: Array<{ address: string; uiAmount: number | null }>
      };
      const accounts = result?.value ?? [];
      if (accounts.length === 0) return [];

      // Percentage must be relative to CIRCULATING SUPPLY, not the sum of the
      // top-20 token accounts — the old maths made a token where the top-20
      // held 3% of supply read as ~100% concentrated. Fall back to sum-of-top
      // only if the supply lookup fails (still labelled clearly downstream).
      let supply = 0;
      try { supply = await getSolanaTokenSupply(mintAddress); } catch { /* fall back below */ }
      const denom = supply > 0
        ? supply
        : accounts.reduce((s, a) => s + (a.uiAmount ?? 0), 0);
      if (denom === 0) return [];

      // getTokenLargestAccounts returns TOKEN ACCOUNTS, not owner wallets.
      // Resolve each to its owner (data.parsed.info.owner) so the bubble map
      // shows real holders, not associated-token-account addresses. One batched
      // getMultipleAccounts (jsonParsed) instead of N calls.
      let owners: Record<string, string> = {};
      try {
        const info = await solanaRpc('getMultipleAccounts', [
          accounts.map(a => a.address),
          { encoding: 'jsonParsed' },
        ]) as { value: Array<{ data?: { parsed?: { info?: { owner?: string } } } } | null> };
        (info?.value ?? []).forEach((acc, i) => {
          const owner = acc?.data?.parsed?.info?.owner;
          if (owner) owners[accounts[i].address] = owner;
        });
      } catch { owners = {}; }

      return accounts.map(a => ({
        // Prefer the resolved owner wallet; fall back to the token account.
        address: owners[a.address] ?? a.address,
        uiAmount: a.uiAmount ?? 0,
        percentage: Math.round(((a.uiAmount ?? 0) / denom) * 10_000) / 100,
      }));
    } catch {
      return [];
    }
  });
}

/** Fetch digital assets via DAS API */
export async function getSolanaAssetsByOwner(
  ownerAddress: string,
  page = 1,
  limit = 1000
): Promise<unknown> {
  const key = cacheKey('solana', 'assets_by_owner', { ownerAddress, page });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      return await solanaRpc('getAssetsByOwner', {
        ownerAddress,
        page,
        limit,
        displayOptions: { showFungible: true, showNativeBalance: true },
      });
    } catch {
      return { items: [], total: 0 };
    }
  });
}

/** Fetch full transaction details */
export async function getSolanaTransactionDetail(signature: string): Promise<unknown> {
  const key = cacheKey('solana', 'tx_detail', { signature });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      return await solanaRpc('getTransaction', [
        signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
      ]);
    } catch {
      return null;
    }
  });
}

/** Batch token metadata using DAS getAssetBatch */
export async function getSolanaTokenMetaBatch(
  mintAddresses: string[]
): Promise<Map<string, SolanaTokenMetaBatch>> {
  const result = new Map<string, SolanaTokenMetaBatch>();
  if (mintAddresses.length === 0) return result;

  const uncached: string[] = [];
  for (const mint of mintAddresses) {
    const key = cacheKey('solana', 'token_meta_batch', { mint });
    const hit = cache.get<SolanaTokenMetaBatch>(key);
    if (hit) {
      result.set(mint, hit);
    } else {
      uncached.push(mint);
    }
  }

  if (uncached.length === 0) return result;

  try {
    const raw = await solanaRpc('getAssetBatch', { ids: uncached }) as unknown[];
    for (const item of raw ?? []) {
      const r = item as Record<string, unknown>;
      const id = r.id as string;
      if (!id) continue;

      const content = r.content as Record<string, unknown> | undefined;
      const metadata = content?.metadata as Record<string, unknown> | undefined;
      const links = content?.links as Record<string, unknown> | undefined;
      const tokenInfo = r.token_info as Record<string, unknown> | undefined;

      const meta: SolanaTokenMetaBatch = {
        mint: id,
        symbol: (metadata?.symbol as string) || '',
        name: (metadata?.name as string) || '',
        decimals: (tokenInfo?.decimals as number) ?? 0,
        logoUrl: (links?.image as string) || null,
        description: (metadata?.description as string) || null,
      };
      result.set(id, meta);
      cache.set(cacheKey('solana', 'token_meta_batch', { mint: id }), meta, TTL.ENTITY_LABEL);
    }
  } catch (err) {
    console.error('[alchemy-solana] getSolanaTokenMetaBatch failed:', err);
  }

  return result;
}
