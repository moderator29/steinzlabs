import 'server-only';
import type { SourceVerdict } from '@/lib/security/honeypotTriangulator';

/**
 * Per-source honeypot fetchers used by the triangulation route. Each
 * returns a SourceVerdict + a raw payload for cache audit. All
 * functions are resilient: a failed fetch returns 'unknown' so
 * triangulation can still vote on the sources that did respond.
 *
 * No API keys required for any of these endpoints in their public
 * tiers — all hit free public read endpoints with low-rate-limits.
 * If GOPLUS_API_KEY / HONEYPOT_IS_API_KEY are set in env they'll be
 * used; otherwise the call falls back to unauthenticated.
 */

const TIMEOUT_MS = 8000;
const ua = 'Naka-Labs-Triangulator/1.0';

async function safeFetch(url: string, headers?: Record<string, string>): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua, ...(headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* --------------------------- GoPlus --------------------------- */

const GOPLUS_CHAIN_ID: Record<string, string> = {
  ethereum: '1', bsc: '56', polygon: '137', base: '8453', arbitrum: '42161',
  optimism: '10', avalanche: '43114', solana: 'solana',
};

export async function fetchGoPlusVerdict(chain: string, token: string): Promise<{ verdict: SourceVerdict; raw: unknown }> {
  const chainId = GOPLUS_CHAIN_ID[chain.toLowerCase()];
  if (!chainId) return { verdict: 'unknown', raw: null };
  const key = process.env.GOPLUS_API_KEY ?? '';
  const headers: Record<string, string> = key ? { Authorization: key } : {};
  if (chainId === 'solana') {
    const raw = await safeFetch(`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${token}`, headers) as { result?: Record<string, unknown> } | null;
    const node = raw?.result?.[token];
    if (!node) return { verdict: 'unknown', raw: null };
    // Solana payload — flag is non_transferable; closability ⇒ honeypot-like
    const flagged = (node as Record<string, unknown>).non_transferable === '1';
    return { verdict: flagged ? 'honeypot' : 'safe', raw: node };
  }
  const raw = await safeFetch(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${token.toLowerCase()}`, headers) as { result?: Record<string, unknown> } | null;
  const node = raw?.result?.[token.toLowerCase()] as Record<string, unknown> | undefined;
  if (!node) return { verdict: 'unknown', raw: null };
  const honeypot = node.is_honeypot === '1' || node.cannot_sell_all === '1';
  return { verdict: honeypot ? 'honeypot' : 'safe', raw: node };
}

/* -------------------------- Honeypot.is ----------------------- */
// Public endpoint, EVM only. Rate-limited but unauthenticated.

const HONEYPOT_IS_CHAIN: Record<string, string> = {
  ethereum: '1', bsc: '56', polygon: '137', base: '8453', arbitrum: '42161', optimism: '10', avalanche: '43114',
};

export async function fetchHoneypotIsVerdict(chain: string, token: string): Promise<{ verdict: SourceVerdict; raw: unknown }> {
  const chainId = HONEYPOT_IS_CHAIN[chain.toLowerCase()];
  if (!chainId) return { verdict: 'unknown', raw: null };
  const raw = await safeFetch(`https://api.honeypot.is/v2/IsHoneypot?address=${token}&chainID=${chainId}`) as { honeypotResult?: { isHoneypot?: boolean }; simulationSuccess?: boolean } | null;
  if (!raw) return { verdict: 'unknown', raw: null };
  if (raw.honeypotResult?.isHoneypot === true) return { verdict: 'honeypot', raw };
  if (raw.simulationSuccess === true && raw.honeypotResult?.isHoneypot === false) return { verdict: 'safe', raw };
  return { verdict: 'unknown', raw };
}

/* ----------------------------- de.fi --------------------------- */
// Public scanner endpoint. EVM only.

export async function fetchDeFiVerdict(chain: string, token: string): Promise<{ verdict: SourceVerdict; raw: unknown }> {
  if (chain.toLowerCase() === 'solana') return { verdict: 'unknown', raw: null };
  const raw = await safeFetch(`https://public-api.de.fi/v1/scanner/${chain}/${token}`) as { critical_issues?: number; high_issues?: number; honeypot?: boolean } | null;
  if (!raw) return { verdict: 'unknown', raw: null };
  if (raw.honeypot === true) return { verdict: 'honeypot', raw };
  // No explicit honeypot flag but high/critical issues present → still flag
  if ((raw.critical_issues ?? 0) > 0) return { verdict: 'honeypot', raw };
  if ((raw.high_issues ?? 0) === 0 && (raw.critical_issues ?? 0) === 0) return { verdict: 'safe', raw };
  return { verdict: 'unknown', raw };
}

/* --------------------------- RugCheck -------------------------- */
// Solana only. Public read-only endpoint.

export async function fetchRugCheckVerdict(chain: string, token: string): Promise<{ verdict: SourceVerdict; raw: unknown }> {
  if (chain.toLowerCase() !== 'solana') return { verdict: 'unknown', raw: null };
  const raw = await safeFetch(`https://api.rugcheck.xyz/v1/tokens/${token}/report`) as { score?: number; rugged?: boolean; risks?: Array<{ level?: string }> } | null;
  if (!raw) return { verdict: 'unknown', raw: null };
  if (raw.rugged === true) return { verdict: 'honeypot', raw };
  const danger = (raw.risks ?? []).some((r) => r.level === 'danger' || r.level === 'critical');
  if (danger) return { verdict: 'honeypot', raw };
  if (typeof raw.score === 'number' && raw.score <= 200) return { verdict: 'safe', raw };
  return { verdict: 'unknown', raw };
}
