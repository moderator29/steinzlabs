import 'server-only';

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

/**
 * Recent token BUYS by an EVM wallet (DEX acquisitions of a non-base token).
 * Mirrors getSolanaWalletBuys; token address comes from Currency.SmartContract,
 * base tokens excluded by symbol. Fails closed ([]). Verify in ide.bitquery.io.
 */
export async function getEvmWalletBuys(
  chain: string,
  address: string,
  sinceIso: string,
  limit = 10,
): Promise<WalletBuy[]> {
  const network = EVM_NETWORK_BY_CHAIN[chain.toLowerCase()];
  if (!isBitqueryEnabled() || !network || !address || !sinceIso) return [];
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];
  try {
    const json = (await bitqueryPost(EVM_WALLET_BUYS_QUERY, {
      network, address, since: sinceIso, limit: Math.min(limit, 25),
    })) as { data?: { EVM?: { DEXTrades?: unknown[] } } } | null;
    const rows: unknown[] = json?.data?.EVM?.DEXTrades ?? [];
    if (!Array.isArray(rows)) return [];

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
    return out;
  } catch {
    return [];
  }
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
  if (!isBitqueryEnabled() || !address || !sinceIso) return [];
  try {
    const json = (await bitqueryPost(SOLANA_WALLET_BUYS_QUERY, {
      address, since: sinceIso, limit: Math.min(limit, 25),
    })) as { data?: { Solana?: { DEXTrades?: unknown[] } } } | null;
    const rows: unknown[] = json?.data?.Solana?.DEXTrades ?? [];
    if (!Array.isArray(rows)) return [];

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
    return out;
  } catch {
    return [];
  }
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
  if (!isBitqueryEnabled() || !address || !sinceIso) return [];
  try {
    const json = (await bitqueryPost(SOLANA_WALLET_SELLS_QUERY, {
      address, since: sinceIso, limit: Math.min(limit, 25),
    })) as { data?: { Solana?: { DEXTrades?: unknown[] } } } | null;
    const rows: unknown[] = json?.data?.Solana?.DEXTrades ?? [];
    if (!Array.isArray(rows)) return [];

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
    return out;
  } catch {
    return [];
  }
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
  if (!isBitqueryEnabled() || !network || !address || !sinceIso) return [];
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];
  try {
    const json = (await bitqueryPost(EVM_WALLET_SELLS_QUERY, {
      network, address, since: sinceIso, limit: Math.min(limit, 25),
    })) as { data?: { EVM?: { DEXTrades?: unknown[] } } } | null;
    const rows: unknown[] = json?.data?.EVM?.DEXTrades ?? [];
    if (!Array.isArray(rows)) return [];

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
    return out;
  } catch {
    return [];
  }
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
