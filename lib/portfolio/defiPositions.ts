/**
 * DeFi positions normalizer. Wraps Zerion's /v1/wallets/<addr>/positions
 * endpoint (?filter[positions]=only_complex) into a shape the
 * portfolio UI renders without provider-coupling. Recognizes the
 * common position types:
 *
 *   • deposit     Aave / Compound / Lido lending or staking
 *   • staked      LP staked into a farm
 *   • locked      vesting / time-locked positions
 *   • borrowed    debt position (negative net worth contribution)
 *   • liquidity   Uniswap V2/V3 LP token
 *   • reward      claimable but unrealized
 *
 * Audit §B.1 portfolio DeFi tab.
 */

export type DefiKind = 'deposit' | 'staked' | 'locked' | 'borrowed' | 'liquidity' | 'reward' | 'other';

export interface ZerionPosition {
  type?: string;
  attributes?: {
    position_type?: string | null;
    protocol?: string | null;
    name?: string | null;
    value?: number | null;
    fungible_info?: { symbol?: string | null; icon?: { url?: string | null } | null } | null;
    chain?: { id?: string | null } | null;
    flags?: { displayable?: boolean | null } | null;
  } | null;
}

export interface DefiPosition {
  kind: DefiKind;
  protocol: string;
  poolName: string;
  symbol: string | null;
  chain: string;
  valueUsd: number;
  iconUrl: string | null;
}

const ZERION_KIND_MAP: Record<string, DefiKind> = {
  deposit: 'deposit',
  staked: 'staked',
  locked: 'locked',
  borrowed: 'borrowed',
  loan: 'borrowed',
  liquidity: 'liquidity',
  reward: 'reward',
  rewards: 'reward',
};

function mapKind(raw: string | null | undefined): DefiKind {
  if (!raw) return 'other';
  return ZERION_KIND_MAP[raw.toLowerCase()] ?? 'other';
}

export function fromZerion(positions: ZerionPosition[]): DefiPosition[] {
  return positions
    .map((p): DefiPosition | null => {
      const a = p.attributes;
      if (!a) return null;
      if (a.flags?.displayable === false) return null;
      const value = typeof a.value === 'number' ? a.value : 0;
      return {
        kind: mapKind(a.position_type),
        protocol: a.protocol ?? 'Unknown',
        poolName: a.name ?? '',
        symbol: a.fungible_info?.symbol ?? null,
        chain: a.chain?.id ?? 'unknown',
        valueUsd: value,
        iconUrl: a.fungible_info?.icon?.url ?? null,
      };
    })
    .filter((p): p is DefiPosition => p !== null);
}

/**
 * Roll up per protocol so the DeFi tab can render 'Aave V3 · $42K · 3
 * positions' instead of three separate rows for each Aave reserve.
 */
export interface ProtocolRollup {
  protocol: string;
  chains: string[];
  positions: number;
  valueUsd: number;
  netUsd: number; // value minus debt
  kinds: DefiKind[];
}

export function rollupByProtocol(positions: DefiPosition[]): ProtocolRollup[] {
  const map = new Map<string, ProtocolRollup>();
  for (const p of positions) {
    const prior = map.get(p.protocol);
    const debtDelta = p.kind === 'borrowed' ? -p.valueUsd : p.valueUsd;
    if (prior) {
      prior.positions += 1;
      prior.valueUsd += p.valueUsd;
      prior.netUsd += debtDelta;
      if (!prior.chains.includes(p.chain)) prior.chains.push(p.chain);
      if (!prior.kinds.includes(p.kind)) prior.kinds.push(p.kind);
    } else {
      map.set(p.protocol, {
        protocol: p.protocol,
        chains: [p.chain],
        positions: 1,
        valueUsd: p.valueUsd,
        netUsd: debtDelta,
        kinds: [p.kind],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.netUsd - a.netUsd);
}
