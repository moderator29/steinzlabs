import 'server-only';
import { cache, TTL } from '../api/cache-manager';
// FREE fallback providers. The owner pays ONLY for Anthropic + Vercel; Zerion is
// a PAID off-matrix API that returns nothing without ZERION_API_KEY. When the key
// is absent — or Zerion errors / returns empty — we fall back INTERNALLY to free
// providers so downstream consumers keep receiving the exact same shapes:
//   (1) Sim by Dune (free tier)  →  cross-chain portfolio + recent trades
//   (2) Alchemy (EVM) priced via CoinGecko/DexScreener (both keyless/free)
// All of these are already wired elsewhere in the repo; we only re-map here.
import { isSimConfigured, getSimPortfolio, getSimRecentTrades, type SimBalance, type SimRecentTrade } from './sim';
import { getEthBalance, getTokenBalances, getTokenMetadata, getAssetTransfers, type TokenTransfer } from './alchemy';
import { getTokenPrice, getContractPrice } from './coingecko';
import { getDexPriceForChain } from './dexscreener';

// Zerion is multichain but the exported fns carry NO chain arg, and Alchemy needs
// an explicit network. Ethereum mainnet is the canonical last-resort; Sim (step 1)
// already covers cross-chain when it is configured, so the Alchemy leg is only hit
// for EVM mainnet holdings when Sim is unavailable.
const ALCHEMY_FALLBACK_CHAIN = 'ethereum';

// ─── Auth ──────────────────────────────────────────────────────────────────────

const BASE = 'https://api.zerion.io';

function authHeader(): string {
  const key = process.env.ZERION_API_KEY ?? '';
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

// ─── Zerion Response Types ─────────────────────────────────────────────────────

export interface ZerionFungibleInfo {
  name: string;
  symbol: string;
  icon?: { url: string | null };
  implementations?: Array<{
    chain_id: string;
    address: string | null;
    decimals: number;
  }>;
}

export interface ZerionPositionAttributes {
  name: string;
  position_type: 'wallet' | 'deposit' | 'staked' | 'locked' | 'loan';
  quantity: { int: string; decimals: number; float: number; numeric: string };
  value: number | null;
  price: number | null;
  changes: { absolute_1d: number | null; percent_1d: number | null } | null;
  fungible_info: ZerionFungibleInfo;
  flags: { displayable: boolean; is_trash: boolean };
}

export interface ZerionPosition {
  type: 'positions';
  id: string;
  attributes: ZerionPositionAttributes;
  relationships?: {
    chain?: { data: { id: string } };
    fungible?: { data: { id: string } };
  };
}

export interface ZerionTransactionAttributes {
  operation_type: string;
  hash: string;
  mined_at: string;
  mined_at_block: number;
  sent_from: string;
  sent_to: string | null;
  status: 'confirmed' | 'failed' | 'pending';
  nonce: number | null;
  fee?: { value: number | null; price: number | null };
  transfers?: Array<{
    fungible_info: ZerionFungibleInfo;
    direction: 'in' | 'out';
    quantity: { float: number; numeric: string };
    value: number | null;
  }>;
}

export interface ZerionTransaction {
  type: 'transactions';
  id: string;
  attributes: ZerionTransactionAttributes;
  relationships?: {
    chain?: { data: { id: string } };
  };
}

export interface ZerionPortfolioAttributes {
  total: { positions: number };
  changes: {
    absolute_1d: number;
    percent_1d: number;
    absolute_1w: number;
    percent_1w: number;
    absolute_1m: number;
    percent_1m: number;
  } | null;
  positions_distribution_by_type?: Record<string, number>;
  positions_distribution_by_chain?: Record<string, number>;
}

// ─── Normalised Token (matches existing PortfolioToken) ────────────────────────

export interface NormalizedToken {
  symbol: string;
  name: string;
  balance: string;
  price: number;
  valueUsd: number;
  change24h: number;
  contractAddress: string;
  logo: string | null;
  isNative: boolean;
  chain: string;
}

export interface NormalizedPortfolio {
  totalValue: number;
  change24h: number;
  change24hPct: number;
  change7d: number;
  change7dPct: number;
}

export interface NormalizedTransaction {
  hash: string;
  type: string;
  status: string;
  timestamp: string;
  chain: string;
  from: string;
  to: string | null;
  valueUsd: number | null;
  fee: number | null;
  transfers: Array<{
    symbol: string;
    direction: 'in' | 'out';
    amount: number;
    valueUsd: number | null;
  }>;
}

// ─── Internal fetch util ───────────────────────────────────────────────────────

async function zerionGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Zerion ${path} → ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ─── fetchWalletPositions ──────────────────────────────────────────────────────

export async function fetchWalletPositions(address: string): Promise<NormalizedToken[]> {
  const key = `zerion:positions:${address.toLowerCase()}`;
  const cached = cache.get<NormalizedToken[]>(key);
  if (cached) return cached;

  // Preferred source: Zerion, but ONLY when its paid key exists.
  if (process.env.ZERION_API_KEY) {
    try {
      // filter[position_types]=wallet — only wallet (not DeFi protocol positions)
      // filter[trash]=only_non_trash — skip spam tokens
      const path =
        `/v1/wallets/${address}/positions/` +
        `?filter[position_types]=wallet` +
        `&filter[trash]=only_non_trash` +
        `&currency=usd` +
        `&sort=value`;

      const json = await zerionGet<{ data: ZerionPosition[] }>(path);
      const tokens: NormalizedToken[] = (json.data ?? [])
        .filter(p => p.attributes.flags.displayable && !p.attributes.flags.is_trash)
        .filter(p => (p.attributes.value ?? 0) >= 1) // dust filter: skip < $1
        .map(p => {
          const attr = p.attributes;
          const chain = p.relationships?.chain?.data?.id ?? 'ethereum';
          const impl = attr.fungible_info.implementations?.find(i => i.chain_id === chain);
          const contractAddress = impl?.address ?? 'native';

          return {
            symbol: attr.fungible_info.symbol ?? '',
            name: attr.fungible_info.name ?? '',
            balance: String(attr.quantity.float.toFixed(attr.quantity.decimals > 4 ? 4 : 2)),
            price: attr.price ?? 0,
            valueUsd: attr.value ?? 0,
            change24h: attr.changes?.percent_1d ?? 0,
            contractAddress,
            logo: attr.fungible_info.icon?.url ?? null,
            isNative: contractAddress === 'native' || contractAddress === null,
            chain,
          } satisfies NormalizedToken;
        });

      // Non-empty Zerion data wins. Empty → fall through to free providers below
      // (an empty paid response is exactly the "silently starved" case we harden).
      if (tokens.length > 0) {
        cache.set(key, tokens, TTL.WALLET_BALANCE);
        return tokens;
      }
    } catch (err) {
      console.error('[zerion] fetchWalletPositions failed, using free fallback:', err);
    }
  }

  // FREE fallback: Sim → Alchemy(+CoinGecko/DexScreener). Never fabricates —
  // returns [] honestly when even the free providers have nothing.
  const fallback = await positionsViaFreeProviders(address);
  if (fallback.length > 0) cache.set(key, fallback, TTL.WALLET_BALANCE);
  return fallback;
}

// ─── fetchWalletPortfolio ──────────────────────────────────────────────────────

export async function fetchWalletPortfolio(address: string): Promise<NormalizedPortfolio> {
  const key = `zerion:portfolio:${address.toLowerCase()}`;
  const cached = cache.get<NormalizedPortfolio>(key);
  if (cached) return cached;

  // Preferred source: Zerion, but ONLY when its paid key exists.
  if (process.env.ZERION_API_KEY) {
    try {
      const json = await zerionGet<{ data: { attributes: ZerionPortfolioAttributes } }>(
        `/v1/wallets/${address}/portfolio/?currency=usd`
      );
      const attr = json.data.attributes;
      const result: NormalizedPortfolio = {
        totalValue: attr.total.positions,
        change24h: attr.changes?.absolute_1d ?? 0,
        change24hPct: attr.changes?.percent_1d ?? 0,
        change7d: attr.changes?.absolute_1w ?? 0,
        change7dPct: attr.changes?.percent_1w ?? 0,
      };
      // A real (> $0) total wins. A zero total from a keyed account is treated as
      // "starved" and falls through to the free providers below.
      if (result.totalValue > 0) {
        cache.set(key, result, TTL.GENERAL);
        return result;
      }
    } catch (err) {
      console.error('[zerion] fetchWalletPortfolio failed, using free fallback:', err);
    }
  }

  // FREE fallback: Sim total_usd, else sum of Alchemy-priced positions.
  const fallback = await portfolioViaFreeProviders(address);
  if (fallback.totalValue > 0) cache.set(key, fallback, TTL.GENERAL);
  return fallback;
}

// ─── fetchWalletTransactions ───────────────────────────────────────────────────

export async function fetchWalletTransactions(
  address: string,
  limit = 25
): Promise<NormalizedTransaction[]> {
  const key = `zerion:txns:${address.toLowerCase()}:${limit}`;
  const cached = cache.get<NormalizedTransaction[]>(key);
  if (cached) return cached;

  // Preferred source: Zerion, but ONLY when its paid key exists.
  if (process.env.ZERION_API_KEY) {
    try {
      const path =
        `/v1/wallets/${address}/transactions/` +
        `?currency=usd` +
        `&page[size]=${Math.min(limit, 100)}` +
        `&filter[operation_types]=trade,send,receive,approve,stake,unstake,claim,borrow,repay`;

      const json = await zerionGet<{ data: ZerionTransaction[] }>(path);
      const txns: NormalizedTransaction[] = (json.data ?? []).map(tx => {
        const attr = tx.attributes;
        const chain = tx.relationships?.chain?.data?.id ?? 'unknown';
        return {
          hash: attr.hash,
          type: attr.operation_type,
          status: attr.status,
          timestamp: attr.mined_at,
          chain,
          from: attr.sent_from,
          to: attr.sent_to,
          valueUsd: attr.fee?.value ?? null,
          fee: attr.fee?.price ?? null,
          transfers: (attr.transfers ?? []).map(t => ({
            symbol: t.fungible_info.symbol ?? '',
            direction: t.direction,
            amount: t.quantity.float,
            valueUsd: t.value ?? null,
          })),
        } satisfies NormalizedTransaction;
      });

      if (txns.length > 0) {
        cache.set(key, txns, TTL.WALLET_BALANCE);
        return txns;
      }
    } catch (err) {
      console.error('[zerion] fetchWalletTransactions failed, using free fallback:', err);
    }
  }

  // FREE fallback: Sim recent trades, else Alchemy asset transfers.
  const fallback = await transactionsViaFreeProviders(address, limit);
  if (fallback.length > 0) cache.set(key, fallback, TTL.WALLET_BALANCE);
  return fallback;
}

// ─── FREE fallback providers ───────────────────────────────────────────────────
// Everything below only runs when Zerion is unavailable/empty. It re-maps free
// data sources onto the SAME Normalized* shapes the exported fns return, so no
// consumer (app/api/portfolio/route.ts et al.) has to change.

/** Format a human-unit token amount for the `balance` string field. */
function formatBalance(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  return amount.toFixed(amount > 1000 ? 2 : 6);
}

/**
 * Live USD price for an ERC-20: CoinGecko contract price first (free public/Demo
 * tier), then DexScreener (keyless) so a token CoinGecko doesn't index still gets
 * a real on-chain price. Returns 0 when neither source has it — never guessed.
 */
async function priceErc20(contractAddress: string, chain: string): Promise<number> {
  const cg = await getContractPrice(contractAddress, chain).catch(() => 0);
  if (cg > 0) return cg;
  const dex = await getDexPriceForChain(contractAddress, chain).catch(() => 0);
  return dex > 0 ? dex : 0;
}

/** Map Sim by Dune balances → NormalizedToken[] (cross-chain, dust-filtered). */
function mapSimBalancesToTokens(balances: SimBalance[]): NormalizedToken[] {
  return balances
    .map(b => {
      const amount = parseFloat(b.amount) || 0;
      const valueUsd = b.usd_value ?? 0;
      const addr = b.address ?? '';
      const isNative = !addr || addr === 'native';
      // Derive per-token price from Sim's authoritative usd_value; never invent one.
      const price = amount > 0 && valueUsd > 0 ? valueUsd / amount : 0;
      return {
        symbol: b.symbol ?? '',
        name: b.name ?? b.symbol ?? '',
        balance: formatBalance(amount),
        price,
        valueUsd,
        change24h: 0, // Sim's balances endpoint carries no 24h delta
        contractAddress: isNative ? 'native' : addr,
        logo: null,
        isNative,
        chain: b.chain ?? 'ethereum',
      } satisfies NormalizedToken;
    })
    .filter(t => t.valueUsd >= 1) // dust filter, mirrors the Zerion path (< $1 skipped)
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

/** EVM positions via Alchemy, priced via CoinGecko/DexScreener. */
async function positionsViaAlchemy(address: string): Promise<NormalizedToken[]> {
  const chain = ALCHEMY_FALLBACK_CHAIN;

  const [nativeBalStr, nativePrice, rawBalances] = await Promise.all([
    getEthBalance(address, chain).catch(() => '0'),
    getTokenPrice('ethereum').catch(() => 0),
    getTokenBalances(address, chain).catch(() => []),
  ]);

  const nativeBalance = parseFloat(nativeBalStr) || 0;
  const nonZero = rawBalances
    .filter(b => b.tokenBalance && b.tokenBalance !== '0')
    .slice(0, 25);

  const tokenResults = await Promise.allSettled(
    nonZero.map(async (b): Promise<NormalizedToken | null> => {
      const meta = await getTokenMetadata(b.contractAddress, chain);
      const decimals = meta.decimals ?? 18;
      const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, decimals);
      if (balance <= 0) return null;
      const price = await priceErc20(b.contractAddress, chain);
      return {
        symbol: meta.symbol || 'UNKNOWN',
        name: meta.name || 'Unknown Token',
        balance: formatBalance(balance),
        price,
        valueUsd: balance * price,
        change24h: 0, // Alchemy balances carry no price change
        contractAddress: b.contractAddress,
        logo: meta.logo ?? null,
        isNative: false,
        chain,
      } satisfies NormalizedToken;
    })
  );

  const tokens = tokenResults
    .filter((r): r is PromiseFulfilledResult<NormalizedToken | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((t): t is NormalizedToken => t !== null && t.valueUsd >= 1); // dust filter parity

  const out: NormalizedToken[] = [];
  // Native shown whenever held (matches the route's Alchemy fallback behaviour).
  if (nativeBalance > 0) {
    out.push({
      symbol: 'ETH',
      name: 'Ethereum',
      balance: formatBalance(nativeBalance),
      price: nativePrice,
      valueUsd: nativeBalance * nativePrice,
      change24h: 0,
      contractAddress: 'native',
      logo: null,
      isNative: true,
      chain,
    });
  }
  out.push(...tokens);
  return out.sort((a, b) => b.valueUsd - a.valueUsd);
}

/** Positions fallback chain: Sim (cross-chain) → Alchemy (EVM mainnet). */
async function positionsViaFreeProviders(address: string): Promise<NormalizedToken[]> {
  if (isSimConfigured()) {
    const sim = await getSimPortfolio(address).catch(() => null);
    if (sim && sim.balances.length > 0) {
      const tokens = mapSimBalancesToTokens(sim.balances);
      if (tokens.length > 0) return tokens;
    }
  }
  return positionsViaAlchemy(address);
}

/** Portfolio summary fallback: Sim total_usd, else sum of priced positions. */
async function portfolioViaFreeProviders(address: string): Promise<NormalizedPortfolio> {
  const empty: NormalizedPortfolio = {
    totalValue: 0, change24h: 0, change24hPct: 0, change7d: 0, change7dPct: 0,
  };

  if (isSimConfigured()) {
    const sim = await getSimPortfolio(address).catch(() => null);
    if (sim && sim.total_usd > 0) {
      // Free providers give no portfolio-level 24h/7d deltas → honestly 0, not faked.
      return { ...empty, totalValue: sim.total_usd };
    }
  }

  const tokens = await positionsViaFreeProviders(address).catch(() => [] as NormalizedToken[]);
  const totalValue = tokens.reduce((s, t) => s + t.valueUsd, 0);
  return { ...empty, totalValue };
}

/** Map Sim recent trades → NormalizedTransaction[]. */
function mapSimTradesToTxns(trades: SimRecentTrade[], address: string): NormalizedTransaction[] {
  return trades.map(t => ({
    hash: t.tx_hash,
    type: t.side, // 'buy' | 'sell' — Sim's own swap classification
    status: 'confirmed', // Sim only returns mined trades
    timestamp: t.block_time,
    chain: t.chain,
    from: address,
    to: null, // Sim's trades feed exposes no counterparty address
    valueUsd: t.usd_value ?? null,
    fee: null, // no gas fee in Sim's recent-trades feed
    transfers: [
      { symbol: t.token_in.symbol ?? '', direction: 'in' as const, amount: parseFloat(t.token_in.amount) || 0, valueUsd: t.usd_value ?? null },
      { symbol: t.token_out.symbol ?? '', direction: 'out' as const, amount: parseFloat(t.token_out.amount) || 0, valueUsd: t.usd_value ?? null },
    ],
  } satisfies NormalizedTransaction));
}

/** Map Alchemy outbound asset transfers → NormalizedTransaction[]. */
function mapAlchemyTransfersToTxns(transfers: TokenTransfer[], chain: string): NormalizedTransaction[] {
  return transfers.map(tx => ({
    hash: tx.hash,
    type: 'send', // getAssetTransfers(direction='from') = outbound transfers
    status: 'confirmed',
    timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : '',
    chain,
    from: tx.from,
    to: tx.to || null,
    valueUsd: null, // raw transfers carry no USD valuation
    fee: null,
    transfers: [
      { symbol: tx.asset || '', direction: 'out' as const, amount: parseFloat(tx.value) || 0, valueUsd: null },
    ],
  } satisfies NormalizedTransaction));
}

/** Transactions fallback chain: Sim recent trades → Alchemy asset transfers. */
async function transactionsViaFreeProviders(address: string, limit: number): Promise<NormalizedTransaction[]> {
  if (isSimConfigured()) {
    const trades = await getSimRecentTrades(address, limit).catch(() => [] as SimRecentTrade[]);
    if (trades.length > 0) return mapSimTradesToTxns(trades, address).slice(0, limit);
  }
  const transfers = await getAssetTransfers(address, ALCHEMY_FALLBACK_CHAIN, 'from', Math.min(limit, 100))
    .catch(() => [] as TokenTransfer[]);
  return mapAlchemyTransfersToTxns(transfers, ALCHEMY_FALLBACK_CHAIN).slice(0, limit);
}
