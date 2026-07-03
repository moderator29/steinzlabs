import 'server-only';
import crypto from 'crypto';

// Trust Wallet developer-ecosystem integration (owner decision 2026-07-03).
// Two independent pieces:
//
//  1. ASSETS LOGO REGISTRY (no key, verifiable today) — the public
//     trustwallet/assets GitHub repo hosts token logos for ~180 chains at
//     raw.githubusercontent.com. Used as the universal logo BACKSTOP behind
//     Alchemy/DexScreener/GeckoTerminal images so any CA resolves with a
//     logo candidate. EVM paths require EIP-55 checksummed addresses.
//
//  2. API GATEWAY CLIENT (HMAC, env-gated) — tws.trustwallet.com free tier
//     (1 req/s) for token info / security second-opinions / trending. Auth:
//     HMAC-SHA256 over METHOD+PATH+QUERY+ACCESS_ID+NONCE+DATE, base64 in
//     Authorization, plus X-TW-Credential / X-TW-Nonce / X-TW-Date headers.
//     Fully inert until TWAK_ACCESS_ID + TWAK_HMAC_SECRET are set in env.
//     NOTE: concrete endpoint paths must be confirmed against
//     developer.trustwallet.com/developer/agent-sdk once the owner's key
//     exists — twGet() is the transport, callers own the paths.

const ASSET_CHAIN_DIRS: Record<string, string> = {
  ethereum: 'ethereum',
  bsc: 'smartchain',
  bnb: 'smartchain',
  polygon: 'polygon',
  arbitrum: 'arbitrum',
  base: 'base',
  optimism: 'optimism',
  avalanche: 'avalanchec',
  solana: 'solana',
  fantom: 'fantom',
  cronos: 'cronos',
  tron: 'tron',
};

/**
 * Ordered candidate logo URLs for a token — callers try them in order via
 * <img onError> fallthrough or a HEAD probe. Never fabricates: these are
 * real registry paths that either 200 or 404.
 */
export async function trustWalletAssetLogoUrl(
  chain: string,
  address: string,
): Promise<string | null> {
  const dir = ASSET_CHAIN_DIRS[chain.toLowerCase()];
  if (!dir) return null;
  let pathAddress = address;
  if (address.startsWith('0x')) {
    try {
      const { getAddress } = await import('ethers');
      pathAddress = getAddress(address.toLowerCase());
    } catch {
      return null; // invalid EVM address — no registry path exists
    }
  }
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${dir}/assets/${pathAddress}/logo.png`;
}

/** Native-coin / chain logo from the registry (info/logo.png). */
export function trustWalletChainLogoUrl(chain: string): string | null {
  const dir = ASSET_CHAIN_DIRS[chain.toLowerCase()];
  if (!dir) return null;
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${dir}/info/logo.png`;
}

const TW_BASE = 'https://tws.trustwallet.com';

export function twGatewayConfigured(): boolean {
  return !!(process.env.TWAK_ACCESS_ID && process.env.TWAK_HMAC_SECRET);
}

/**
 * HMAC-signed GET against the Trust Wallet API Gateway. Returns parsed JSON
 * or null (missing key, non-2xx, network failure) — callers must treat this
 * strictly as an ADDITIVE enrichment behind the primary providers, never a
 * hard dependency (free tier is 1 req/s).
 */
export async function twGet<T = unknown>(path: string, query: Record<string, string> = {}): Promise<T | null> {
  const accessId = process.env.TWAK_ACCESS_ID;
  const secret = process.env.TWAK_HMAC_SECRET;
  if (!accessId || !secret) return null;
  try {
    const qs = new URLSearchParams(query).toString();
    const nonce = crypto.randomUUID();
    const date = new Date().toISOString();
    const payload = `GET${path}${qs}${accessId}${nonce}${date}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    const res = await fetch(`${TW_BASE}${path}${qs ? `?${qs}` : ''}`, {
      headers: {
        Authorization: signature,
        'X-TW-Credential': accessId,
        'X-TW-Nonce': nonce,
        'X-TW-Date': date,
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
