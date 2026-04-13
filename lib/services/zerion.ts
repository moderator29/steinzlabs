import 'server-only';
import { cache, TTL } from '../api/cache-manager';

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

    cache.set(key, tokens, TTL.WALLET_BALANCE);
    return tokens;
  } catch (err) {
    console.error('[zerion] fetchWalletPositions failed:', err);
    return [];
  }
}

// ─── fetchWalletPortfolio ──────────────────────────────────────────────────────

export async function fetchWalletPortfolio(address: string): Promise<NormalizedPortfolio> {
  const key = `zerion:portfolio:${address.toLowerCase()}`;
  const cached = cache.get<NormalizedPortfolio>(key);
  if (cached) return cached;

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
    cache.set(key, result, TTL.GENERAL);
    return result;
  } catch (err) {
    console.error('[zerion] fetchWalletPortfolio failed:', err);
    return { totalValue: 0, change24h: 0, change24hPct: 0, change7d: 0, change7dPct: 0 };
  }
}

// ─── fetchWalletTransactions ───────────────────────────────────────────────────

export async function fetchWalletTransactions(
  address: string,
  limit = 25
): Promise<NormalizedTransaction[]> {
  const key = `zerion:txns:${address.toLowerCase()}:${limit}`;
  const cached = cache.get<NormalizedTransaction[]>(key);
  if (cached) return cached;

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

    cache.set(key, txns, TTL.WALLET_BALANCE);
    return txns;
  } catch (err) {
    console.error('[zerion] fetchWalletTransactions failed:', err);
    return [];
  }
}
