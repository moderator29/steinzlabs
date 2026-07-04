import 'server-only';
import { cacheKey, TTL, withCache } from '../api/cache-manager';
import { getSolanaTransactions, getSolanaTransactionDetail } from './alchemy-solana';
import { getTokenPrice as getJupiterPrice } from './jupiter';
import { getDexPriceForChain } from './dexscreener';

/**
 * Bitquery — cross-chain discovery of ACTIVE, day-to-day whale TRADERS (the free
 * replacement for the retired Arkham integration).
 *
 * We rank wallets by DEX trading VOLUME (not holdings) over a rolling window and
 * keep only ones that trade on most days and look like real individual traders,
 * not institutions/bots. The bitquery-traders cron applies the activity +
 * anti-institutional filters and UPSERTs survivors into `whales`, which feeds
 * the tracker, follow, watchlist, and copy-trade.
 *
 * GATED: returns [] unless BITQUERY_API_KEY is set, so it's a harmless no-op
 * until you enable it. The EAP GraphQL schema varies by plan — VERIFY the query
 * once in https://ide.bitquery.io before relying on it. Any error / unexpected
 * shape fails closed (returns []) so we never write garbage.
 *
 *   BITQUERY_API_KEY   — required (v2 EAP OAuth access token, "ory_at_…")
 *   BITQUERY_ENDPOINT  — default https://streaming.bitquery.io/graphql
 */

const ENDPOINT = process.env.BITQUERY_ENDPOINT || 'https://streaming.bitquery.io/graphql';

// Our chain slug → Bitquery EAP `network` enum value (EVM only). Solana is a
// separate top-level dataset, handled below.
const EVM_NETWORK_BY_CHAIN: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  polygon: 'matic',
  bsc: 'bsc',
};

export interface ActiveTrader {
  address: string;
  chain: string;
  volumeUsd: number;
  trades: number;
  activeDays: number;
}

export function isBitqueryEnabled(): boolean {
  return !!process.env.BITQUERY_API_KEY;
}

async function bitqueryPost(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const apiKey = process.env.BITQUERY_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  return res.json();
}

const EVM_QUERY = `
  query ActiveEvmTraders($network: evm_network, $since: DateTime, $limit: Int) {
    EVM(network: $network) {
      DEXTrades(
        limit: { count: $limit }
        orderBy: { descendingByField: "volumeUsd" }
        where: { Block: { Time: { since: $since } } }
      ) {
        Trade { Buy { Buyer } }
        volumeUsd: sum(of: Trade_Buy_AmountInUSD)
        trades: count
        activeDays: uniq(of: Block_Date)
      }
    }
  }`;

const SOLANA_QUERY = `
  query ActiveSolanaTraders($since: DateTime, $limit: Int) {
    Solana {
      DEXTrades(
        limit: { count: $limit }
        orderBy: { descendingByField: "volumeUsd" }
        where: { Block: { Time: { since: $since } } }
      ) {
        Trade { Buy { Account { Owner } } }
        volumeUsd: sum(of: Trade_Buy_AmountInUSD)
        trades: count
        activeDays: uniq(of: Block_Date)
      }
    }
  }`;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// Solana base/quote mints — when a wallet "buys" one of these it's really an
// EXIT (sold a token for base), so we don't record it as a token buy.
const SOLANA_BASE_MINTS = new Set([
  'So11111111111111111111111111111111111111112',  // wSOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',  // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',  // USDT
]);

export interface WalletBuy {
  txHash: string;
  tokenMint: string;
  tokenSymbol: string | null;
  amount: number;
  valueUsd: number | null;
  timestamp: string;
}

const SOLANA_WALLET_BUYS_QUERY = `
  query WalletBuys($address: String, $since: DateTime, $limit: Int) {
    Solana {
      DEXTrades(
        limit: { count: $limit }
        orderBy: { descending: Block_Time }
        where: {
          Block: { Time: { since: $since } }
          Trade: { Buy: { Account: { Owner: { is: $address } } } }
        }
      ) {
        Block { Time }
        Transaction { Signature }
        Trade {
          Buy { Amount AmountInUSD Currency { Symbol MintAddress } }
        }
      }
    }
  }`;

// EVM base/quote token SYMBOLS — a "buy" of one of these is really an exit.
const EVM_BASE_SYMBOLS = new Set([
  'WETH', 'ETH', 'USDC', 'USDC.E', 'USDT', 'DAI', 'WBNB', 'BNB',
  'WBTC', 'WMATIC', 'MATIC', 'WAVAX', 'AVAX', 'FRAX', 'BUSD',
]);

const EVM_WALLET_BUYS_QUERY = `
  query EvmWalletBuys($network: evm_network, $address: String, $since: DateTime, $limit: Int) {
    EVM(network: $network) {
      DEXTrades(
        limit: { count: $limit }
        orderBy: { descending: Block_Time }
        where: {
          Block: { Time: { since: $since } }
          Trade: { Buy: { Buyer: { is: $address } } }
        }
      ) {
        Block { Time }
        Transaction { Hash }
        Trade {
          Buy { Amount AmountInUSD Currency { Symbol SmartContract } }
        }
      }
    }
  }`;

// ─── FREE fallback plumbing ────────────────────────────────────────────────
// WHY: Bitquery is a PAID off-matrix API — bitqueryPost() returns null the moment
// BITQUERY_API_KEY is unset, and the EAP DEXTrades dataset can also error / come
// back empty on a plan that lacks it. That silently starves copy-trade and
// whale-exit signals. To keep them alive on the owner's FREE (Anthropic+Vercel)
// budget we reconstruct the SAME WalletBuy[] shape from already-wired free
// providers:
//   EVM    -> Alchemy ERC-20 asset-transfer history (incoming = buys, outgoing =
//             sells), priced by DexScreener at CURRENT price.
//   Solana -> Alchemy Solana RPC per-tx token-balance deltas, priced by Jupiter.
// We never fabricate: a record with no resolvable token contract/mint is dropped,
// and valueUsd is null (not guessed) when the token can't be priced. Historical
// price at trade time isn't available from the free tier, so USD is a
// current-price estimate — WalletBuy has no `source` field to label, so callers
// treat these identically to the paid rows (same shape, honestly nullable USD).

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';

// EVM chain slug → Alchemy RPC subdomain. Only the chains this module maps for
// Bitquery. The exported alchemy.getAssetTransfers helper DROPS rawContract, but
// WalletBuy.tokenMint REQUIRES the token contract, so we read the raw
// alchemy_getAssetTransfers JSON-RPC here to keep the address.
const ALCHEMY_EVM_SUBDOMAIN: Record<string, string> = {
  ethereum: 'eth-mainnet',
  base: 'base-mainnet',
  arbitrum: 'arb-mainnet',
  optimism: 'opt-mainnet',
  polygon: 'polygon-mainnet',
  bsc: 'bnb-mainnet',
};

interface RawEvmTransfer {
  hash: string;
  contract: string;
  symbol: string | null;
  amount: number;
  timestamp: string;
}

/**
 * ERC-20 transfers for a wallet on `chain`, newest first, within [sinceIso, now].
 * `direction: 'to'` = tokens arriving (buys), `'from'` = tokens leaving (sells).
 * Returns the token CONTRACT (needed for tokenMint + pricing) which the shared
 * alchemy helper discards. Returns [] when the Alchemy key/chain is unavailable.
 */
async function getEvmErc20Transfers(
  chain: string,
  address: string,
  direction: 'to' | 'from',
  sinceIso: string,
  maxCount: number,
): Promise<RawEvmTransfer[]> {
  const subdomain = ALCHEMY_EVM_SUBDOMAIN[chain.toLowerCase()];
  if (!subdomain || !ALCHEMY_API_KEY) return [];
  const sinceMs = Date.parse(sinceIso);
  const url = `https://${subdomain}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const params: Record<string, unknown> = {
    [direction === 'to' ? 'toAddress' : 'fromAddress']: address,
    category: ['erc20'],
    withMetadata: true,
    excludeZeroValue: true,
    order: 'desc',
    maxCount: '0x' + Math.min(Math.max(maxCount, 1), 1000).toString(16),
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'alchemy_getAssetTransfers', params: [params] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { result?: { transfers?: Array<Record<string, unknown>> } };
    const transfers = json.result?.transfers ?? [];
    const out: RawEvmTransfer[] = [];
    for (const t of transfers) {
      const meta = t.metadata as { blockTimestamp?: string } | undefined;
      const iso = meta?.blockTimestamp ?? '';
      // Honour the same time window the paid path filters on.
      if (iso && Number.isFinite(sinceMs) && Date.parse(iso) < sinceMs) continue;
      const rc = t.rawContract as { address?: string } | undefined;
      const contract = String(rc?.address ?? '').trim().toLowerCase();
      const hash = String(t.hash ?? '').trim();
      if (!hash || !/^0x[a-fA-F0-9]{40}$/.test(contract)) continue;
      out.push({
        hash,
        contract,
        symbol: (t.asset as string | null) ?? null,
        amount: num(t.value),
        timestamp: iso || new Date().toISOString(),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Reconstruct EVM wallet buys/sells from free Alchemy + DexScreener data. */
async function evmWalletTradesFallback(
  chain: string,
  address: string,
  sinceIso: string,
  limit: number,
  side: 'buy' | 'sell',
): Promise<WalletBuy[]> {
  const key = cacheKey('bitquery-fallback', side === 'buy' ? 'evm_buys' : 'evm_sells', {
    chain: chain.toLowerCase(), address: address.toLowerCase(), sinceIso, limit,
  });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    // Over-fetch: base-token legs and unpriceable tokens get filtered out below.
    const transfers = await getEvmErc20Transfers(
      chain, address, side === 'buy' ? 'to' : 'from', sinceIso, Math.min(limit, 25) * 4,
    );
    const priceCache = new Map<string, number>();
    const out: WalletBuy[] = [];
    for (const t of transfers) {
      if (out.length >= limit) break;
      // A move of a base/quote token is the OTHER side of the swap, not a token buy.
      if (t.symbol && EVM_BASE_SYMBOLS.has(t.symbol.toUpperCase())) continue;
      let price = priceCache.get(t.contract);
      if (price === undefined) {
        try { price = await getDexPriceForChain(t.contract, chain); } catch { price = 0; }
        priceCache.set(t.contract, price);
      }
      out.push({
        txHash: t.hash,
        tokenMint: t.contract,
        tokenSymbol: t.symbol,
        amount: t.amount,
        valueUsd: price > 0 ? price * t.amount : null,
        timestamp: t.timestamp,
      });
    }
    return out;
  });
}

/**
 * Per-mint token-balance delta (post − pre) for `owner` in one parsed Solana tx.
 * Positive = tokens acquired (a buy leg), negative = tokens disposed (a sell leg).
 */
function ownerMintDeltas(
  meta: { preTokenBalances?: Array<Record<string, unknown>>; postTokenBalances?: Array<Record<string, unknown>> },
  owner: string,
): Map<string, number> {
  const fold = (rows: Array<Record<string, unknown>> | undefined, into: Map<string, number>) => {
    for (const b of rows ?? []) {
      if (String(b.owner ?? '') !== owner) continue;
      const mint = String(b.mint ?? '');
      if (!mint) continue;
      const uta = b.uiTokenAmount as { uiAmount?: number | null } | undefined;
      const ui = typeof uta?.uiAmount === 'number' ? uta.uiAmount : 0;
      into.set(mint, (into.get(mint) ?? 0) + ui);
    }
  };
  const pre = new Map<string, number>();
  const post = new Map<string, number>();
  fold(meta.preTokenBalances, pre);
  fold(meta.postTokenBalances, post);
  const delta = new Map<string, number>();
  for (const m of new Set([...pre.keys(), ...post.keys()])) {
    delta.set(m, (post.get(m) ?? 0) - (pre.get(m) ?? 0));
  }
  return delta;
}

/** Reconstruct Solana wallet buys/sells from free Alchemy RPC + Jupiter pricing. */
async function solanaWalletTradesFallback(
  address: string,
  sinceIso: string,
  limit: number,
  side: 'buy' | 'sell',
): Promise<WalletBuy[]> {
  const key = cacheKey('bitquery-fallback', side === 'buy' ? 'sol_buys' : 'sol_sells', {
    address, sinceIso, limit,
  });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    const sinceMs = Date.parse(sinceIso);
    const sinceSec = Number.isFinite(sinceMs) ? Math.floor(sinceMs / 1000) : 0;
    // getSolanaTransactions only lists signatures (desc by time); token flow lives
    // in the per-tx detail, so we fetch details for a bounded window of recent sigs.
    const sigs = await getSolanaTransactions(address, 100);
    const priceCache = new Map<string, number>();
    const out: WalletBuy[] = [];
    let scanned = 0;
    for (const sig of sigs) {
      if (out.length >= limit) break;
      if (scanned >= 60) break; // bound the per-tx detail fan-out
      if (sig.type === 'FAILED') continue;
      if (sinceSec && sig.timestamp && sig.timestamp < sinceSec) continue;
      scanned++;
      const detail = (await getSolanaTransactionDetail(sig.signature)) as {
        blockTime?: number;
        meta?: {
          err?: unknown;
          preTokenBalances?: Array<Record<string, unknown>>;
          postTokenBalances?: Array<Record<string, unknown>>;
        };
      } | null;
      if (!detail?.meta || detail.meta.err) continue;
      const deltas = ownerMintDeltas(detail.meta, address);
      // The token leg = the non-base mint whose delta matches the side, largest first.
      let best: { mint: string; amount: number } | null = null;
      for (const [mint, d] of deltas) {
        if (SOLANA_BASE_MINTS.has(mint)) continue;
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) continue;
        const signed = side === 'buy' ? d : -d;
        if (signed <= 0) continue;
        if (!best || signed > best.amount) best = { mint, amount: signed };
      }
      if (!best) continue;
      let price = priceCache.get(best.mint);
      if (price === undefined) {
        try { price = await getJupiterPrice(best.mint); } catch { price = 0; }
        priceCache.set(best.mint, price);
      }
      const ts = detail.blockTime ?? sig.timestamp ?? 0;
      out.push({
        txHash: sig.signature,
        tokenMint: best.mint,
        tokenSymbol: null,
        amount: best.amount,
        valueUsd: price > 0 ? price * best.amount : null,
        timestamp: ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
      });
    }
    return out;
  });
}

/**
 * Recent token BUYS by an EVM wallet (DEX acquisitions of a non-base token).
 * Mirrors getSolanaWalletBuys; token address comes from Currency.SmartContract,
 * base tokens excluded by symbol. Prefers Bitquery when keyed; otherwise (or when
 * the paid call errors / returns empty) falls back to free Alchemy+DexScreener.
 */
export async function getEvmWalletBuys(
  chain: string,
  address: string,
  sinceIso: string,
  limit = 10,
): Promise<WalletBuy[]> {
  const network = EVM_NETWORK_BY_CHAIN[chain.toLowerCase()];
  if (!network || !address || !sinceIso) return [];
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];
  if (isBitqueryEnabled()) {
    try {
      const json = (await bitqueryPost(EVM_WALLET_BUYS_QUERY, {
        network, address, since: sinceIso, limit: Math.min(limit, 25),
      })) as { data?: { EVM?: { DEXTrades?: unknown[] } } } | null;
      const rows: unknown[] = json?.data?.EVM?.DEXTrades ?? [];
      if (Array.isArray(rows)) {
        const out: WalletBuy[] = [];
        for (const r of rows as Array<Record<string, unknown>>) {
          const block = r.Block as Record<string, unknown> | undefined;
          const txn = r.Transaction as Record<string, unknown> | undefined;
          const trade = r.Trade as Record<string, unknown> | undefined;
          const buy = trade?.Buy as Record<string, unknown> | undefined;
          const cur = buy?.Currency as Record<string, unknown> | undefined;
          const token = String(cur?.SmartContract ?? '').trim().toLowerCase();
          const symbol = (cur?.Symbol as string | null) ?? null;
          const hash = String(txn?.Hash ?? '').trim();
          if (!hash || !/^0x[a-fA-F0-9]{40}$/.test(token)) continue;
          if (symbol && EVM_BASE_SYMBOLS.has(symbol.toUpperCase())) continue;
          out.push({
            txHash: hash,
            tokenMint: token,
            tokenSymbol: symbol,
            amount: num(buy?.Amount),
            valueUsd: buy?.AmountInUSD != null ? num(buy.AmountInUSD) : null,
            timestamp: String(block?.Time ?? new Date().toISOString()),
          });
        }
        if (out.length) return out; // prefer paid data when it actually has rows
      }
    } catch {
      /* paid path failed — fall through to the free fallback below */
    }
  }
  return evmWalletTradesFallback(chain, address, sinceIso, limit, 'buy');
}

/**
 * Recent token BUYS by a Solana wallet (DEX acquisitions of a non-base token).
 * We deliberately capture only clear token buys — the highest-value copy signal
 * — to avoid mislabeling buy/sell on the unverified Solana schema. Bitquery
 * supplies AmountInUSD so no extra pricing is needed. Fails closed ([]).
 * VERIFY field paths in ide.bitquery.io for your plan before trusting.
 */
export async function getSolanaWalletBuys(
  address: string,
  sinceIso: string,
  limit = 10,
): Promise<WalletBuy[]> {
  if (!address || !sinceIso) return [];
  if (isBitqueryEnabled()) {
    try {
      const json = (await bitqueryPost(SOLANA_WALLET_BUYS_QUERY, {
        address, since: sinceIso, limit: Math.min(limit, 25),
      })) as { data?: { Solana?: { DEXTrades?: unknown[] } } } | null;
      const rows: unknown[] = json?.data?.Solana?.DEXTrades ?? [];
      if (Array.isArray(rows)) {
        const out: WalletBuy[] = [];
        for (const r of rows as Array<Record<string, unknown>>) {
          const block = r.Block as Record<string, unknown> | undefined;
          const txn = r.Transaction as Record<string, unknown> | undefined;
          const trade = r.Trade as Record<string, unknown> | undefined;
          const buy = trade?.Buy as Record<string, unknown> | undefined;
          const cur = buy?.Currency as Record<string, unknown> | undefined;
          const mint = String(cur?.MintAddress ?? '').trim();
          const sig = String(txn?.Signature ?? '').trim();
          // Must be a real token acquisition (not base) with a tx + valid mint.
          if (!sig || !mint || SOLANA_BASE_MINTS.has(mint)) continue;
          if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) continue;
          out.push({
            txHash: sig,
            tokenMint: mint,
            tokenSymbol: (cur?.Symbol as string | null) ?? null,
            amount: num(buy?.Amount),
            valueUsd: buy?.AmountInUSD != null ? num(buy.AmountInUSD) : null,
            timestamp: String(block?.Time ?? new Date().toISOString()),
          });
        }
        if (out.length) return out; // prefer paid data when it actually has rows
      }
    } catch {
      /* paid path failed — fall through to the free fallback below */
    }
  }
  return solanaWalletTradesFallback(address, sinceIso, limit, 'buy');
}

const SOLANA_WALLET_SELLS_QUERY = `
  query WalletSells($address: String, $since: DateTime, $limit: Int) {
    Solana {
      DEXTrades(
        limit: { count: $limit }
        orderBy: { descending: Block_Time }
        where: {
          Block: { Time: { since: $since } }
          Trade: { Sell: { Account: { Owner: { is: $address } } } }
        }
      ) {
        Block { Time }
        Transaction { Signature }
        Trade {
          Sell { Amount AmountInUSD Currency { Symbol MintAddress } }
        }
      }
    }
  }`;

const EVM_WALLET_SELLS_QUERY = `
  query EvmWalletSells($network: evm_network, $address: String, $since: DateTime, $limit: Int) {
    EVM(network: $network) {
      DEXTrades(
        limit: { count: $limit }
        orderBy: { descending: Block_Time }
        where: {
          Block: { Time: { since: $since } }
          Trade: { Sell: { Seller: { is: $address } } }
        }
      ) {
        Block { Time }
        Transaction { Hash }
        Trade {
          Sell { Amount AmountInUSD Currency { Symbol SmartContract } }
        }
      }
    }
  }`;

/**
 * Recent token SELLS by a Solana wallet (DEX disposals of a non-base token —
 * the whale-EXIT signal that complements getSolanaWalletBuys). Reads the Sell
 * leg; excludes selling a base mint (that's really a buy of the other side).
 * Fails closed ([]).
 */
export async function getSolanaWalletSells(
  address: string,
  sinceIso: string,
  limit = 10,
): Promise<WalletBuy[]> {
  if (!address || !sinceIso) return [];
  if (isBitqueryEnabled()) {
    try {
      const json = (await bitqueryPost(SOLANA_WALLET_SELLS_QUERY, {
        address, since: sinceIso, limit: Math.min(limit, 25),
      })) as { data?: { Solana?: { DEXTrades?: unknown[] } } } | null;
      const rows: unknown[] = json?.data?.Solana?.DEXTrades ?? [];
      if (Array.isArray(rows)) {
        const out: WalletBuy[] = [];
        for (const r of rows as Array<Record<string, unknown>>) {
          const block = r.Block as Record<string, unknown> | undefined;
          const txn = r.Transaction as Record<string, unknown> | undefined;
          const trade = r.Trade as Record<string, unknown> | undefined;
          const sell = trade?.Sell as Record<string, unknown> | undefined;
          const cur = sell?.Currency as Record<string, unknown> | undefined;
          const mint = String(cur?.MintAddress ?? '').trim();
          const sig = String(txn?.Signature ?? '').trim();
          if (!sig || !mint || SOLANA_BASE_MINTS.has(mint)) continue;
          if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) continue;
          out.push({
            txHash: sig,
            tokenMint: mint,
            tokenSymbol: (cur?.Symbol as string | null) ?? null,
            amount: num(sell?.Amount),
            valueUsd: sell?.AmountInUSD != null ? num(sell.AmountInUSD) : null,
            timestamp: String(block?.Time ?? new Date().toISOString()),
          });
        }
        if (out.length) return out; // prefer paid data when it actually has rows
      }
    } catch {
      /* paid path failed — fall through to the free fallback below */
    }
  }
  return solanaWalletTradesFallback(address, sinceIso, limit, 'sell');
}

/**
 * Recent token SELLS by an EVM wallet (DEX disposals of a non-base token).
 * Mirrors getSolanaWalletSells on the Sell leg. Fails closed ([]).
 */
export async function getEvmWalletSells(
  chain: string,
  address: string,
  sinceIso: string,
  limit = 10,
): Promise<WalletBuy[]> {
  const network = EVM_NETWORK_BY_CHAIN[chain.toLowerCase()];
  if (!network || !address || !sinceIso) return [];
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];
  if (isBitqueryEnabled()) {
    try {
      const json = (await bitqueryPost(EVM_WALLET_SELLS_QUERY, {
        network, address, since: sinceIso, limit: Math.min(limit, 25),
      })) as { data?: { EVM?: { DEXTrades?: unknown[] } } } | null;
      const rows: unknown[] = json?.data?.EVM?.DEXTrades ?? [];
      if (Array.isArray(rows)) {
        const out: WalletBuy[] = [];
        for (const r of rows as Array<Record<string, unknown>>) {
          const block = r.Block as Record<string, unknown> | undefined;
          const txn = r.Transaction as Record<string, unknown> | undefined;
          const trade = r.Trade as Record<string, unknown> | undefined;
          const sell = trade?.Sell as Record<string, unknown> | undefined;
          const cur = sell?.Currency as Record<string, unknown> | undefined;
          const token = String(cur?.SmartContract ?? '').trim().toLowerCase();
          const symbol = (cur?.Symbol as string | null) ?? null;
          const hash = String(txn?.Hash ?? '').trim();
          if (!hash || !/^0x[a-fA-F0-9]{40}$/.test(token)) continue;
          if (symbol && EVM_BASE_SYMBOLS.has(symbol.toUpperCase())) continue;
          out.push({
            txHash: hash,
            tokenMint: token,
            tokenSymbol: symbol,
            amount: num(sell?.Amount),
            valueUsd: sell?.AmountInUSD != null ? num(sell.AmountInUSD) : null,
            timestamp: String(block?.Time ?? new Date().toISOString()),
          });
        }
        if (out.length) return out; // prefer paid data when it actually has rows
      }
    } catch {
      /* paid path failed — fall through to the free fallback below */
    }
  }
  return evmWalletTradesFallback(chain, address, sinceIso, limit, 'sell');
}

/**
 * Diagnostic probe for the admin verification endpoint ONLY. Unlike the
 * fail-closed production helpers, this SURFACES the HTTP status and any GraphQL
 * `errors` so a misnamed field (the most likely cause of an empty-but-keyed
 * result) is visible instead of silently swallowed. Never used in the hot path.
 */
export async function bitqueryDiagnostic(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; errors?: string[]; dataKeys?: string[]; rowCount?: number }> {
  const apiKey = process.env.BITQUERY_API_KEY;
  if (!apiKey) return { ok: false, status: 0, errors: ['BITQUERY_API_KEY not set'] };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(25_000),
    });
    const json = (await res.json().catch(() => null)) as
      | { data?: Record<string, unknown>; errors?: Array<{ message?: string }> }
      | null;
    const errors = json?.errors?.map((e) => e.message ?? 'unknown').filter(Boolean);
    const dataKeys = json?.data ? Object.keys(json.data) : undefined;
    return { ok: res.ok && !errors?.length, status: res.status, errors, dataKeys };
  } catch (e) {
    return { ok: false, status: 0, errors: [e instanceof Error ? e.message : 'fetch failed'] };
  }
}

export { SOLANA_QUERY, EVM_QUERY };

const CHAIN_METRICS_EVM_QUERY = `
  query ChainMetrics($network: evm_network, $since: DateTime) {
    EVM(network: $network) {
      DEXTrades(where: { Block: { Time: { since: $since } } }) {
        volumeUsd: sum(of: Trade_Buy_AmountInUSD)
        activeAddresses: uniq(of: Trade_Buy_Buyer)
      }
    }
  }`;

const CHAIN_METRICS_SOL_QUERY = `
  query SolChainMetrics($since: DateTime) {
    Solana {
      DEXTrades(where: { Block: { Time: { since: $since } } }) {
        volumeUsd: sum(of: Trade_Buy_AmountInUSD)
        activeAddresses: uniq(of: Trade_Buy_Account_Owner)
      }
    }
  }`;

/**
 * Real DEX volume + unique active trader count for a chain since `sinceIso`.
 * Powers the on-chain trends Volume/Addresses cards with REAL data (replacing
 * placeholders). Fails closed (returns null) — never fabricates.
 */
export async function getChainDexMetrics(
  chain: string,
  sinceIso: string,
): Promise<{ volumeUsd: number; activeAddresses: number } | null> {
  if (!isBitqueryEnabled() || !sinceIso) return null;
  const c = chain.toLowerCase();
  const isSolana = c === 'solana';
  const network = isSolana ? null : EVM_NETWORK_BY_CHAIN[c];
  if (!isSolana && !network) return null;
  try {
    const json = (await bitqueryPost(
      isSolana ? CHAIN_METRICS_SOL_QUERY : CHAIN_METRICS_EVM_QUERY,
      isSolana ? { since: sinceIso } : { network, since: sinceIso },
    )) as { data?: { EVM?: { DEXTrades?: unknown[] }; Solana?: { DEXTrades?: unknown[] } } } | null;
    const rows = (isSolana ? json?.data?.Solana?.DEXTrades : json?.data?.EVM?.DEXTrades) ?? [];
    const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
    if (!row) return null;
    return { volumeUsd: num(row.volumeUsd), activeAddresses: num(row.activeAddresses) };
  } catch {
    return null;
  }
}

/**
 * Top DEX traders on `chain` since `sinceIso`, by USD volume, with trade count
 * and distinct active-day count so the caller can apply activity filters.
 * EVM-shaped 0x or Solana base58 only. Fails closed (returns []).
 */
export async function getActiveTraders(
  chain: string,
  opts: { sinceIso: string; limit?: number },
): Promise<ActiveTrader[]> {
  if (!isBitqueryEnabled() || !opts.sinceIso) return [];
  const c = chain.toLowerCase();
  const isSolana = c === 'solana';
  const network = isSolana ? null : EVM_NETWORK_BY_CHAIN[c];
  if (!isSolana && !network) return [];
  const limit = Math.min(opts.limit ?? 100, 200);

  try {
    const json = (await bitqueryPost(
      isSolana ? SOLANA_QUERY : EVM_QUERY,
      isSolana ? { since: opts.sinceIso, limit } : { network, since: opts.sinceIso, limit },
    )) as { data?: { EVM?: { DEXTrades?: unknown[] }; Solana?: { DEXTrades?: unknown[] } } } | null;

    const rows: unknown[] = (isSolana ? json?.data?.Solana?.DEXTrades : json?.data?.EVM?.DEXTrades) ?? [];
    if (!Array.isArray(rows)) return [];

    const out: ActiveTrader[] = [];
    const seen = new Set<string>();
    for (const r of rows as Array<Record<string, unknown>>) {
      const trade = r.Trade as Record<string, unknown> | undefined;
      const buy = trade?.Buy as Record<string, unknown> | undefined;
      const account = buy?.Account as Record<string, unknown> | undefined;
      const raw = String((isSolana ? account?.Owner : buy?.Buyer) ?? '').trim();
      const valid = isSolana
        ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw)
        : /^0x[a-fA-F0-9]{40}$/.test(raw);
      if (!valid) continue;
      const dedupe = isSolana ? raw : raw.toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({
        address: isSolana ? raw : raw.toLowerCase(),
        chain: c,
        volumeUsd: num(r.volumeUsd),
        trades: num(r.trades),
        activeDays: num(r.activeDays),
      });
    }
    return out;
  } catch {
    return [];
  }
}
