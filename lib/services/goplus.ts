import 'server-only';
import { cache, cacheKey, TTL } from '../api/cache-manager';
import {
  scanTokenSecurity,
  scanAddress,
  scanDomain,
  decodeSignature,
  simulateTransaction,
  detectDustTokens,
  type TokenSecurityResult,
  type AddressScanResult,
  type DomainScanResult,
  type SignatureDecodeResult,
  type TxSimulationResult,
} from '../security/goplusService';

/**
 * GoPlus Security Service
 * Backend only — never expose GoPlus branding in the UI.
 * All results are surfaced as "Security Scanner" or "VTX Security" in the frontend.
 */

// Re-export types so callers import from one place
export type {
  TokenSecurityResult,
  AddressScanResult,
  DomainScanResult,
  SignatureDecodeResult,
  TxSimulationResult,
};

export async function getTokenSecurity(
  contractAddress: string,
  chain: string
): Promise<TokenSecurityResult> {
  const key = cacheKey('goplus', 'token_security', { contractAddress: contractAddress.toLowerCase(), chain });
  const cached = cache.get<TokenSecurityResult>(key);
  if (cached) return cached;

  const result = await scanTokenSecurity(contractAddress, chain);
  cache.set(key, result, TTL.TOKEN_SECURITY);
  return result;
}

export async function getAddressSecurity(
  address: string,
  chain: string
): Promise<AddressScanResult> {
  const key = cacheKey('goplus', 'address_security', { address: address.toLowerCase(), chain });
  const cached = cache.get<AddressScanResult>(key);
  if (cached) return cached;

  const result = await scanAddress(address, chain);
  cache.set(key, result, TTL.TOKEN_SECURITY);
  return result;
}

export async function getDomainSecurity(url: string): Promise<DomainScanResult> {
  const key = cacheKey('goplus', 'domain', { url });
  const cached = cache.get<DomainScanResult>(key);
  if (cached) return cached;

  const result = await scanDomain(url);
  cache.set(key, result, TTL.TOKEN_SECURITY);
  return result;
}

export async function getSignatureDecode(
  data: string,
  chain: string
): Promise<SignatureDecodeResult> {
  // Signatures are deterministic — cache indefinitely (24h)
  const key = cacheKey('goplus', 'signature', { data: data.slice(0, 20), chain });
  const cached = cache.get<SignatureDecodeResult>(key);
  if (cached) return cached;

  const result = await decodeSignature(data, chain);
  cache.set(key, result, TTL.ENTITY_LABEL);
  return result;
}

export async function getTxSimulation(
  fromAddress: string,
  toAddress: string,
  data: string,
  value: string,
  chain: string
): Promise<TxSimulationResult> {
  return simulateTransaction(fromAddress, toAddress, data, value, chain);
}

export async function getDustTokens(
  address: string,
  chain: string,
  tokens: string[]
): Promise<string[]> {
  return detectDustTokens(address, chain, tokens);
}

/**
 * Quick risk check — returns true if the token MUST be blocked from
 * swap execution. Used by `getSwapQuote` to gate the EVM swap path.
 *
 * Block rules (any one is sufficient — these are non-negotiable):
 *   - isHoneypot                        → confirmed honeypot
 *   - cannotBuy                         → buys disabled at the contract level
 *   - cannotSellAll                     → can buy but cannot fully exit
 *   - selfDestruct                      → contract can self-destruct
 *   - canTakeBackOwnership              → renounce can be reversed
 *   - ownerCanChangeBalance             → owner can rug your balance directly
 *   - hasHiddenOwner                    → opaque owner control
 *   - sellTax > 30%                     → effectively a soft honeypot
 *   - composite riskScore > threshold   → catch-all for combined signals
 *
 * §10 audit fix — earlier version relied solely on the composite score,
 * meaning a pure honeypot (one -40 point hit, trustScore=60, risk=40)
 * slipped through the default 70 threshold. Each individual block flag
 * must independently trigger a block regardless of the rest of the
 * scorecard.
 */
export async function isHighRisk(
  contractAddress: string,
  chain: string,
  threshold = 70
): Promise<boolean> {
  try {
    const result = await getTokenSecurity(contractAddress, chain);
    if (result.isHoneypot) return true;
    if (result.cannotBuy) return true;
    if (result.cannotSellAll) return true;
    if (result.selfDestruct) return true;
    if (result.canTakeBackOwnership) return true;
    if (result.ownerCanChangeBalance) return true;
    if (result.hasHiddenOwner) return true;
    if ((result.sellTax ?? 0) > 0.30) return true;
    const riskScore = 100 - result.trustScore;
    return riskScore > threshold;
  } catch {
    return false; // Fail open — don't block swaps when scanner is unavailable
  }
}
