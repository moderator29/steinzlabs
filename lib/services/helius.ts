import 'server-only';
import { heliusRotation, RateLimitError } from '../api/rotation-manager';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * Helius Solana Data Service
 * Uses 2-key rotation for rate limit handling.
 */

const BASE = 'https://mainnet.helius-rpc.com';
const API_BASE = 'https://api.helius.xyz/v0';
const TIMEOUT_MS = parseInt(process.env.HELIUS_TIMEOUT_MS || '12000', 10);

async function heliusRpc(method: string, params: unknown[]): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    let apiKey: string;
    try {
      apiKey = heliusRotation.getNextKey();
    } catch (e) {
      throw e;
    }

    try {
      const res = await fetch(`${BASE}/?api-key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.status === 429) {
        heliusRotation.markRateLimited(apiKey, 60_000);
        continue;
      }

      if (!res.ok) throw new Error(`Helius RPC error: ${res.status}`);
      const data = await res.json() as { result?: unknown; error?: { message: string } };
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Helius: all attempts failed');
}

async function heliusApi(endpoint: string, body?: unknown): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    let apiKey: string;
    try {
      apiKey = heliusRotation.getNextKey();
    } catch (e) {
      throw e;
    }

    try {
      const url = `${API_BASE}${endpoint}?api-key=${apiKey}`;
      const res = body
        ? await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          })
        : await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

      if (res.status === 429) {
        heliusRotation.markRateLimited(apiKey, 60_000);
        continue;
      }

      if (!res.ok) throw new Error(`Helius API error: ${res.status}`);
      return res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Helius: all attempts failed');
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  fee: number;
  feePayer: string;
  slot: number;
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  tokenTransfers?: { fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }[];
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getSolanaTokenMeta(mintAddress: string): Promise<SolanaTokenMeta | null> {
  const key = cacheKey('helius', 'token_meta', { mintAddress });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      const result = await heliusApi(`/token-metadata`, {
        mintAccounts: [mintAddress],
        includeOffChain: true,
        disableCache: false,
      }) as unknown[];

      const meta = result?.[0] as Record<string, unknown>;
      if (!meta) return null;

      const onChain = meta.onChainMetadata as Record<string, unknown> | undefined;
      const offChain = meta.offChainMetadata as Record<string, unknown> | undefined;
      const account = meta.onChainAccountInfo as Record<string, unknown> | undefined;

      return {
        mint: mintAddress,
        name: (onChain?.metadata as Record<string, unknown>)?.name as string || (offChain?.metadata as Record<string, unknown>)?.name as string || '',
        symbol: (onChain?.metadata as Record<string, unknown>)?.symbol as string || (offChain?.metadata as Record<string, unknown>)?.symbol as string || '',
        decimals: (account?.accountInfo as Record<string, unknown>)?.data as unknown as number || 0,
        supply: 0,
        mintAuthority: null,
        freezeAuthority: null,
        isInitialized: true,
        logoUrl: (offChain?.metadata as Record<string, unknown>)?.image as string | undefined,
        description: (offChain?.metadata as Record<string, unknown>)?.description as string | undefined,
      };
    } catch {
      return null;
    }
  });
}

export async function getSolanaWalletTokens(walletAddress: string): Promise<SolanaBalance[]> {
  const key = cacheKey('helius', 'wallet_tokens', { walletAddress });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const result = await heliusRpc('getTokenAccountsByOwner', [
        walletAddress,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ]) as { value: unknown[] };

      return (result?.value ?? []).map((acc: unknown) => {
        const parsed = (acc as Record<string, unknown>).account as Record<string, unknown>;
        const info = ((parsed?.data as Record<string, unknown>)?.parsed as Record<string, unknown>)?.info as Record<string, unknown>;
        const tokenAmount = info?.tokenAmount as Record<string, unknown>;
        return {
          mint: info?.mint as string ?? '',
          amount: tokenAmount?.amount as number ?? 0,
          decimals: tokenAmount?.decimals as number ?? 0,
          uiAmount: tokenAmount?.uiAmount as number ?? 0,
        };
      }).filter(b => b.uiAmount > 0);
    } catch {
      return [];
    }
  });
}

export async function getSolanaTransactions(
  address: string,
  limit = 50
): Promise<HeliusTransaction[]> {
  const key = cacheKey('helius', 'transactions', { address, limit });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const result = await heliusApi(`/addresses/${address}/transactions?limit=${limit}`);
      return (result as HeliusTransaction[]) ?? [];
    } catch {
      return [];
    }
  });
}

export async function getSolanaSOLBalance(address: string): Promise<number> {
  const key = cacheKey('helius', 'sol_balance', { address });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const result = await heliusRpc('getBalance', [address]) as { value: number };
      return (result?.value ?? 0) / 1e9; // lamports to SOL
    } catch {
      return 0;
    }
  });
}

export async function getSolanaTokenSupply(mintAddress: string): Promise<number> {
  const key = cacheKey('helius', 'supply', { mintAddress });
  return withCache(key, TTL.MARKET_CAP, async () => {
    try {
      const result = await heliusRpc('getTokenSupply', [mintAddress]) as {
        value: { amount: string; decimals: number; uiAmount: number }
      };
      return result?.value?.uiAmount ?? 0;
    } catch {
      return 0;
    }
  });
}

export interface SolanaTokenHolder {
  address: string;
  uiAmount: number;
  percentage: number;
}

// ─── Batch Token Metadata ─────────────────────────────────────────────────────

export interface HeliusTokenMeta {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string | null;
  description: string | null;
}

/**
 * Fetch metadata for up to 100 mints in one Helius call.
 * Returns a map keyed by mint address.
 */
export async function getSolanaTokenMetaBatch(
  mintAddresses: string[]
): Promise<Map<string, HeliusTokenMeta>> {
  const result = new Map<string, HeliusTokenMeta>();
  if (mintAddresses.length === 0) return result;

  // Check cache first — only fetch mints we don't have cached
  const uncached: string[] = [];
  const cached: HeliusTokenMeta[] = [];

  for (const mint of mintAddresses) {
    const key = cacheKey('helius', 'token_meta', { mintAddress: mint });
    const hit = cache.get<HeliusTokenMeta>(key);
    if (hit) {
      cached.push(hit);
      result.set(mint, hit);
    } else {
      uncached.push(mint);
    }
  }

  if (uncached.length === 0) return result;

  try {
    // Helius /token-metadata accepts arrays — batch all uncached mints
    const raw = await heliusApi(`/token-metadata`, {
      mintAccounts: uncached,
      includeOffChain: true,
      disableCache: false,
    }) as unknown[];

    for (const item of raw ?? []) {
      const r = item as Record<string, unknown>;
      const mint = r.account as string;
      if (!mint) continue;

      const onChain = ((r.onChainMetadata as Record<string, unknown>)?.metadata as Record<string, unknown>) ?? {};
      const offChain = ((r.offChainMetadata as Record<string, unknown>)?.metadata as Record<string, unknown>) ?? {};
      const accountInfo = ((r.onChainAccountInfo as Record<string, unknown>)?.accountInfo as Record<string, unknown>)?.data as Record<string, unknown> ?? {};
      const parsedInfo = (accountInfo?.parsed as Record<string, unknown>)?.info as Record<string, unknown> ?? {};

      const symbol: string = (onChain.symbol as string) || (offChain.symbol as string) || '';
      const name: string = (onChain.name as string) || (offChain.name as string) || '';
      const decimals: number = (parsedInfo.decimals as number) ?? 0;
      const logoUrl: string | null = (offChain.image as string) || null;
      const description: string | null = (offChain.description as string) || null;

      const meta: HeliusTokenMeta = { mint, symbol, name, decimals, logoUrl, description };
      result.set(mint, meta);
      cache.set(cacheKey('helius', 'token_meta', { mintAddress: mint }), meta, TTL.ENTITY_LABEL);
    }
  } catch (err) {
    console.error('[helius] getSolanaTokenMetaBatch failed:', err);
  }

  return result;
}

/** Fetch the top holders for a Solana SPL token mint. */
export async function getSolanaTokenHolders(mintAddress: string): Promise<SolanaTokenHolder[]> {
  const key = cacheKey('helius', 'token_holders', { mintAddress });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      const result = await heliusRpc('getTokenLargestAccounts', [mintAddress]) as {
        value: Array<{ address: string; uiAmount: number | null }>
      };
      const accounts = result?.value ?? [];
      const totalAmount = accounts.reduce((sum, a) => sum + (a.uiAmount ?? 0), 0);
      if (totalAmount === 0) return [];
      return accounts.map(a => ({
        address: a.address,
        uiAmount: a.uiAmount ?? 0,
        percentage: Math.round(((a.uiAmount ?? 0) / totalAmount) * 10_000) / 100,
      }));
    } catch {
      return [];
    }
  });
}
