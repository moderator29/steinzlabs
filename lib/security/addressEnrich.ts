import 'server-only';
import { cache, cacheKey, TTL } from '../api/cache-manager';
import { normalizeAddress, isEvmChain } from '../utils/addressNormalize';
import { getAddressSecurity } from '../services/goplus';

/**
 * Multi-source spender / address enrichment.
 *
 * The Approval Manager and Security Center wallet-analysis both need to answer
 * two questions about an arbitrary EVM address:
 *   1. "Who is this?"    → a human label ("Uniswap V3: Router 2", "Unverified contract").
 *   2. "Is it dangerous?" → a malicious / scam verdict.
 *
 * Historically that leaned on a single source (GoPlus address_security). This
 * module corroborates it with two more FREE, already-integrated sources and
 * merges them transparently:
 *
 *   · GoPlus address_security   — malicious / phishing / blacklist flags (existing).
 *   · Etherscan API V2          — verified ContractName as a human label, plus an
 *                                 "unverified contract" risk flag and the contract
 *                                 creator. ETHERSCAN_API_KEY is live; one key covers
 *                                 all supported EVM chains via the chainid param.
 *   · Chainabuse (TRM Labs)     — community scam reports as a second-source malicious
 *                                 signal. Env-gated on CHAINABUSE_API_KEY; omitted
 *                                 cleanly (source marked "unavailable") when unset.
 *
 * Every field traces to a real response. When no source resolves a label we return
 * an honest `null` label + a truncated address for display; we never fabricate a
 * protocol name. The merged result records WHICH sources contributed and WHICH
 * agree on maliciousness, so the UI can show corroboration instead of a black box.
 */

// ─── Chain → Etherscan V2 chainid ──────────────────────────────────────────────
// One ETHERSCAN_API_KEY works across every chain below via api.etherscan.io/v2.

const ETHERSCAN_CHAINID: Record<string, number> = {
  ethereum: 1, eth: 1,
  bsc: 56, bnb: 56, binance: 56,
  polygon: 137,
  base: 8453,
  arbitrum: 42161, 'arbitrum-one': 42161, arb: 42161,
  optimism: 10, op: 10,
  avalanche: 43114, avax: 43114,
};

const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';
const CHAINABUSE_ENDPOINT = 'https://api.chainabuse.com/v0/reports';
const TIMEOUT_MS = 10_000;

// ─── Well-known spender labels (curated fallback) ──────────────────────────────
// Canonical protocol routers that either aren't verified under a descriptive
// contract name or that users recognise by brand rather than by ContractName.
// EVM-scoped, so lowercase keys are correct. This is a fallback, not a source of
// truth — Etherscan's verified ContractName wins when present and descriptive.

const KNOWN_SPENDERS: Record<string, string> = {
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3 Router',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3 Router 2',
  '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch V4',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch V5',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange Proxy',
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap Router',
  '0x11111112542d85b3ef69ae05771c2dccff4faa26': '1inch V3',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal Router',
  '0x000000000022d473030f116ddee9f6b43ac78ba3': 'Permit2',
  '0x1bd435f3c054b6e901b7b108a0ab7617c808677b': 'ParaSwap',
  '0x216b4b4ba9f3e719726886d34a177484278bfcae': 'ParaSwap V5',
  '0xa2f78ab2355fe2f984d808b5cee7fd0a93d5270e': 'OpenSea Seaport',
  '0x00000000000000adc04c56bf30ac9d3c0aaf14dc': 'OpenSea Seaport 1.5',
};

// ─── Public types ──────────────────────────────────────────────────────────────

export type EnrichSourceName = 'goplus' | 'etherscan' | 'chainabuse';

/** State of one contributing source for a single enrichment. */
export interface EnrichSourceState {
  source: EnrichSourceName;
  /** 'ok' = queried and returned; 'unavailable' = not configured / errored; 'skip' = not applicable (e.g. non-EVM). */
  status: 'ok' | 'unavailable' | 'skip';
  /** True when this source independently considers the address malicious/scam. */
  malicious: boolean;
  /** Short human note explaining what this source contributed. */
  detail: string;
}

export interface AddressEnrichment {
  address: string;
  chain: string;
  /**
   * Best human label resolved across sources, or null when nothing resolves.
   * Callers render `label ?? shortAddress` — never a fabricated protocol name.
   */
  label: string | null;
  /** Where `label` came from, for transparency. null when label is null. */
  labelSource: 'known-list' | 'etherscan' | null;
  /** Contract creator (deployer) address from Etherscan, when the target is a contract. */
  creator: string | null;
  /** True when Etherscan confirms the address is a contract. null = unknown (source unavailable). */
  isContract: boolean | null;
  /** True when the address is a contract with UNVERIFIED source (a real risk flag). null = unknown. */
  isUnverifiedContract: boolean | null;
  /** Any source flags it malicious/scam. */
  isMalicious: boolean;
  isPhishing: boolean;
  isBlacklisted: boolean;
  /** Count of distinct sources that independently flag it malicious (corroboration strength). */
  maliciousSourceCount: number;
  /** Number of community scam reports from Chainabuse, when configured. null = unavailable. */
  scamReportCount: number | null;
  /** De-duplicated union of category labels across sources ("phishing", "scam-report", "unverified-contract", …). */
  labels: string[];
  /** Per-source status so the UI can show which sources agree / were unavailable. */
  sources: EnrichSourceState[];
}

// ─── Etherscan V2: contract name + verified + creator ──────────────────────────

interface EtherscanSignal {
  contractName: string | null;
  isContract: boolean;
  verified: boolean;
  creator: string | null;
}

/** True when a verified ContractName is descriptive enough to show as a label. */
function usableContractName(name: string | null): name is string {
  if (!name) return false;
  const n = name.trim();
  // Etherscan returns an empty string for EOAs and generic proxy shells.
  if (n.length < 2) return false;
  return true;
}

async function etherscanGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Naka-Labs-Address-Enrich/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Resolve an address's verified contract name, verification status and creator
 * from Etherscan's V2 unified API. Returns null when the key is unset or the
 * chain is unsupported (honest degrade). A missing/empty ContractName with a
 * present ABI means "verified contract, no descriptive name"; an ABI equal to
 * the not-verified sentinel means "unverified contract" (a genuine risk flag).
 */
async function fetchEtherscanSignal(address: string, chain: string): Promise<EtherscanSignal | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const chainid = ETHERSCAN_CHAINID[chain.toLowerCase()];
  if (!apiKey || !chainid) return null;

  const sourceUrl =
    `${ETHERSCAN_V2}?chainid=${chainid}&module=contract&action=getsourcecode` +
    `&address=${address}&apikey=${apiKey}`;

  const sourceJson = await etherscanGet<{
    status: string;
    result?: Array<{ ContractName?: string; ABI?: string; Proxy?: string }>;
  }>(sourceUrl);

  const row = sourceJson?.result?.[0];
  if (!row) return null;

  const abi = row.ABI ?? '';
  const notVerified = abi === 'Contract source code not verified' || abi === '';
  // A non-empty verified ABI (or a descriptive ContractName) means it's a contract.
  const isContract = !notVerified || usableContractName(row.ContractName ?? null);
  const verified = !notVerified;
  const contractName = usableContractName(row.ContractName ?? null) ? row.ContractName!.trim() : null;

  // Creator is only meaningful for contracts; skip the extra call for EOAs.
  let creator: string | null = null;
  if (isContract) {
    const creationUrl =
      `${ETHERSCAN_V2}?chainid=${chainid}&module=contract&action=getcontractcreation` +
      `&contractaddresses=${address}&apikey=${apiKey}`;
    const creationJson = await etherscanGet<{
      status: string;
      result?: Array<{ contractCreator?: string }>;
    }>(creationUrl);
    creator = creationJson?.result?.[0]?.contractCreator ?? null;
  }

  return { contractName, isContract, verified, creator };
}

// ─── Chainabuse: community scam reports ────────────────────────────────────────

interface ChainabuseSignal {
  reportCount: number;
  categories: string[];
}

/**
 * Query Chainabuse (TRM Labs) community scam reports for an address. Returns
 * null when CHAINABUSE_API_KEY is unset (env-gated — the source is simply
 * omitted, never faked). Auth is HTTP Basic with the key as both user and
 * password, per Chainabuse's public API.
 */
async function fetchChainabuseSignal(address: string): Promise<ChainabuseSignal | null> {
  const apiKey = process.env.CHAINABUSE_API_KEY;
  if (!apiKey) return null;

  try {
    const auth = Buffer.from(`${apiKey}:${apiKey}`).toString('base64');
    const url = `${CHAINABUSE_ENDPOINT}?address=${encodeURIComponent(address)}&page=1&perPage=50`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'User-Agent': 'Naka-Labs-Address-Enrich/1.0',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as unknown;
    // Chainabuse returns either a bare array or a paginated { reports: [...] }.
    const rows: Array<Record<string, unknown>> = Array.isArray(json)
      ? (json as Array<Record<string, unknown>>)
      : Array.isArray((json as { reports?: unknown }).reports)
        ? ((json as { reports: Array<Record<string, unknown>> }).reports)
        : [];

    const categories = Array.from(
      new Set(
        rows
          .map((r) => (typeof r.category === 'string' ? r.category : null))
          .filter((c): c is string => !!c)
          .map((c) => c.toLowerCase()),
      ),
    );
    return { reportCount: rows.length, categories };
  } catch {
    return null;
  }
}

// ─── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Enrich a single EVM address by corroborating GoPlus, Etherscan V2 and
 * Chainabuse. All three run in parallel; each degrades independently so one
 * failing source never blanks the others. Cached per (address, chain) for the
 * standard token-security window.
 */
export async function enrichAddress(address: string, chain = 'ethereum'): Promise<AddressEnrichment> {
  const normalized = normalizeAddress(address, chain);
  const key = cacheKey('addressEnrich', 'v1', { address: normalized, chain });
  const hit = cache.get<AddressEnrichment>(key);
  if (hit) return hit;

  const evm = isEvmChain(chain);

  const [goplusSettled, etherscanSettled, chainabuseSettled] = await Promise.allSettled([
    getAddressSecurity(address, chain),
    evm ? fetchEtherscanSignal(address, chain) : Promise.resolve(null),
    evm ? fetchChainabuseSignal(address) : Promise.resolve(null),
  ]);

  const goplus = goplusSettled.status === 'fulfilled' ? goplusSettled.value : null;
  const etherscan = etherscanSettled.status === 'fulfilled' ? etherscanSettled.value : null;
  const chainabuse = chainabuseSettled.status === 'fulfilled' ? chainabuseSettled.value : null;

  const sources: EnrichSourceState[] = [];
  const labels = new Set<string>();

  // ── GoPlus ──
  const goplusMalicious = !!(goplus && (goplus.isMalicious || goplus.isPhishing || goplus.isBlacklisted));
  if (goplus) {
    for (const l of goplus.labels) labels.add(l);
    sources.push({
      source: 'goplus',
      status: 'ok',
      malicious: goplusMalicious,
      detail: goplusMalicious
        ? `Flagged: ${goplus.labels.join(', ') || 'malicious activity'}`
        : 'No threats detected',
    });
  } else {
    sources.push({ source: 'goplus', status: 'unavailable', malicious: false, detail: 'Scanner unavailable' });
  }

  // ── Etherscan ──
  let isContract: boolean | null = null;
  let isUnverifiedContract: boolean | null = null;
  let creator: string | null = null;
  let etherscanLabel: string | null = null;
  if (!evm) {
    sources.push({ source: 'etherscan', status: 'skip', malicious: false, detail: 'Non-EVM chain' });
  } else if (etherscan) {
    isContract = etherscan.isContract;
    creator = etherscan.creator;
    isUnverifiedContract = etherscan.isContract && !etherscan.verified;
    if (etherscan.contractName) etherscanLabel = etherscan.contractName;
    if (isUnverifiedContract) labels.add('unverified-contract');
    const detail = !etherscan.isContract
      ? 'Externally-owned account (not a contract)'
      : etherscan.verified
        ? `Verified contract${etherscan.contractName ? `: ${etherscan.contractName}` : ''}`
        : 'Unverified contract source';
    sources.push({ source: 'etherscan', status: 'ok', malicious: false, detail });
  } else {
    sources.push({
      source: 'etherscan',
      status: 'unavailable',
      malicious: false,
      detail: 'Labels unavailable (key unset or chain unsupported)',
    });
  }

  // ── Chainabuse ──
  let scamReportCount: number | null = null;
  const chainabuseMalicious = !!(chainabuse && chainabuse.reportCount > 0);
  if (!evm) {
    sources.push({ source: 'chainabuse', status: 'skip', malicious: false, detail: 'Non-EVM chain' });
  } else if (chainabuse) {
    scamReportCount = chainabuse.reportCount;
    if (chainabuseMalicious) {
      labels.add('scam-report');
      for (const c of chainabuse.categories) labels.add(`chainabuse:${c}`);
    }
    sources.push({
      source: 'chainabuse',
      status: 'ok',
      malicious: chainabuseMalicious,
      detail: chainabuseMalicious
        ? `${chainabuse.reportCount} community scam report${chainabuse.reportCount === 1 ? '' : 's'}`
        : 'No community reports',
    });
  } else {
    sources.push({
      source: 'chainabuse',
      status: 'unavailable',
      malicious: false,
      detail: 'Community reports unavailable (key unset)',
    });
  }

  // ── Label resolution: verified Etherscan name > curated known-list > null ──
  let label: string | null = null;
  let labelSource: AddressEnrichment['labelSource'] = null;
  if (usableContractName(etherscanLabel)) {
    label = etherscanLabel;
    labelSource = 'etherscan';
  } else {
    const known = evm ? KNOWN_SPENDERS[normalized] : undefined;
    if (known) {
      label = known;
      labelSource = 'known-list';
    }
  }

  const maliciousSourceCount = [goplusMalicious, chainabuseMalicious].filter(Boolean).length;

  const result: AddressEnrichment = {
    address,
    chain,
    label,
    labelSource,
    creator,
    isContract,
    isUnverifiedContract,
    isMalicious: goplusMalicious || chainabuseMalicious,
    isPhishing: !!goplus?.isPhishing,
    isBlacklisted: !!goplus?.isBlacklisted,
    maliciousSourceCount,
    scamReportCount,
    labels: Array.from(labels),
    sources,
  };

  // Label/verification data is stable; malicious flags can flip. Use the
  // token-security window (5 min) as a conservative shared TTL.
  cache.set(key, result, TTL.TOKEN_SECURITY);
  return result;
}

/** Compact display label: resolved name, else a truncated address (never fabricated). */
export function displayLabel(e: Pick<AddressEnrichment, 'label' | 'address'>): string {
  if (e.label) return e.label;
  const a = e.address;
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
