import 'server-only';
import { cache, cacheKey, TTL } from '../api/cache-manager';
import { normalizeAddress, isEvmAddress, isEvmChain } from '../utils/addressNormalize';

/**
 * Honeypot.is Service
 *
 * FREE, no-key, EVM-only honeypot simulator. It runs a real buy + sell
 * simulation against the live chain state and reports whether the token can
 * actually be sold, plus the simulated buy/sell tax and gas. This is a fully
 * independent second opinion to GoPlus's static flag-based honeypot verdict.
 *
 * Backend only — surfaced in the UI as a neutral "Live Simulation" source.
 * Real data only: every field originates from the Honeypot.is response or is
 * omitted. When the token is not simulatable (unsupported chain, no pair, or
 * provider error) we return an honest `available: false` instead of a guess.
 *
 * Docs: https://docs.honeypot.is/ (GET /v2/IsHoneypot)
 */

const BASE = 'https://api.honeypot.is';
const TIMEOUT_MS = parseInt(process.env.HONEYPOT_TIMEOUT_MS || '12000', 10);

/** Honeypot.is only supports a subset of EVM chains (chainID query param). */
const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  bsc: 56,
  bnb: 56,
  base: 8453,
};

export function honeypotChainId(chain: string): number | null {
  return CHAIN_ID_MAP[chain.toLowerCase()] ?? null;
}

/** True when Honeypot.is can simulate this address+chain at all. */
export function honeypotSupported(address: string, chain: string): boolean {
  return isEvmChain(chain) && isEvmAddress(address) && honeypotChainId(chain) != null;
}

export interface HoneypotResult {
  /** Did we get a usable simulation back? false ⇒ honest unknown state. */
  available: boolean;
  /** Why a simulation could not be produced (only set when available=false). */
  unavailableReason?: 'unsupported_chain' | 'no_pair' | 'provider_error';
  /** true ⇒ confirmed honeypot (cannot sell). null ⇒ could not determine. */
  isHoneypot: boolean | null;
  /** Provider's human-readable reason for a honeypot verdict, when present. */
  honeypotReason?: string | null;
  /** Simulated buy tax as a fraction (0.05 = 5%), null when not simulated. */
  buyTax: number | null;
  /** Simulated sell tax as a fraction, null when not simulated. */
  sellTax: number | null;
  /** Simulated transfer tax as a fraction, null when not present. */
  transferTax: number | null;
  /** Did the buy+sell simulation itself succeed? */
  simulationSuccess: boolean;
  /** Gas used by the simulated buy / sell, when reported. */
  buyGas: number | null;
  sellGas: number | null;
  /** Token metadata echoed by the provider (best-effort). */
  tokenName?: string | null;
  tokenSymbol?: string | null;
  /** Holder count from the simulated pair, when reported. */
  holderCount: number | null;
  /** Flags lifted from the provider summary (e.g. risk strings). */
  flags: string[];
  /** Overall provider risk label, when present (e.g. "low", "high"). */
  riskLevel: string | null;
}

interface HoneypotApiResponse {
  token?: { name?: string; symbol?: string; totalHolders?: number };
  simulationSuccess?: boolean;
  honeypotResult?: { isHoneypot?: boolean; honeypotReason?: string };
  simulationResult?: {
    buyTax?: number;
    sellTax?: number;
    transferTax?: number;
    buyGas?: number | string;
    sellGas?: number | string;
  };
  holderAnalysis?: { holders?: number | string };
  summary?: { risk?: string; riskLevel?: number; flags?: string[] };
  error?: string;
  message?: string;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

/** Honeypot.is returns tax as a percentage (e.g. 5 for 5%). Convert to a fraction. */
function pctToFraction(v: unknown): number | null {
  const n = numOrNull(v);
  return n == null ? null : n / 100;
}

async function fetchHoneypot(address: string, chainId: number): Promise<HoneypotApiResponse | null> {
  const url = `${BASE}/v2/IsHoneypot?address=${encodeURIComponent(address)}&chainID=${chainId}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    // 4xx commonly means "no pair to simulate"; treat as a clean no-data state.
    if (res.status >= 400 && res.status < 500) return null;
    throw new Error(`Honeypot.is error: ${res.status}`);
  }
  return (await res.json()) as HoneypotApiResponse;
}

/**
 * Run a live buy/sell simulation via Honeypot.is for an EVM token.
 * Always resolves (never throws) so it can run alongside other sources in a
 * Promise.allSettled fan-out; failure becomes an honest `available: false`.
 */
export async function getHoneypotSimulation(
  address: string,
  chain: string,
): Promise<HoneypotResult> {
  const unavailable = (
    reason: HoneypotResult['unavailableReason'],
  ): HoneypotResult => ({
    available: false,
    unavailableReason: reason,
    isHoneypot: null,
    honeypotReason: null,
    buyTax: null,
    sellTax: null,
    transferTax: null,
    simulationSuccess: false,
    buyGas: null,
    sellGas: null,
    holderCount: null,
    flags: [],
    riskLevel: null,
  });

  const chainId = honeypotChainId(chain);
  if (chainId == null || !isEvmAddress(address)) {
    return unavailable('unsupported_chain');
  }

  const key = cacheKey('honeypot', 'is_honeypot', {
    address: normalizeAddress(address, chain),
    chainId,
  });
  const memHit = cache.get<HoneypotResult>(key);
  if (memHit) return memHit;

  let data: HoneypotApiResponse | null;
  try {
    data = await fetchHoneypot(address, chainId);
  } catch {
    return unavailable('provider_error');
  }
  if (!data) {
    const out = unavailable('no_pair');
    cache.set(key, out, TTL.TOKEN_SECURITY);
    return out;
  }

  const sim = data.simulationResult ?? {};
  const flags = Array.isArray(data.summary?.flags)
    ? data.summary!.flags!.filter((f): f is string => typeof f === 'string')
    : [];

  const result: HoneypotResult = {
    available: true,
    isHoneypot:
      typeof data.honeypotResult?.isHoneypot === 'boolean'
        ? data.honeypotResult.isHoneypot
        : null,
    honeypotReason: data.honeypotResult?.honeypotReason ?? null,
    buyTax: pctToFraction(sim.buyTax),
    sellTax: pctToFraction(sim.sellTax),
    transferTax: pctToFraction(sim.transferTax),
    simulationSuccess: data.simulationSuccess === true,
    buyGas: numOrNull(sim.buyGas),
    sellGas: numOrNull(sim.sellGas),
    tokenName: data.token?.name ?? null,
    tokenSymbol: data.token?.symbol ?? null,
    holderCount: numOrNull(data.holderAnalysis?.holders ?? data.token?.totalHolders),
    flags,
    riskLevel: data.summary?.risk ?? null,
  };

  cache.set(key, result, TTL.TOKEN_SECURITY);
  return result;
}
