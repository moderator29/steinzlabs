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
 * Quick risk check — returns true if risk score exceeds threshold.
 * Used by swap engine to block dangerous tokens.
 */
export async function isHighRisk(
  contractAddress: string,
  chain: string,
  threshold = 70
): Promise<boolean> {
  try {
    const result = await getTokenSecurity(contractAddress, chain);
    // trustScore is 0-100 where 0 = most dangerous, 100 = safest
    // Convert to risk score (inverse) for consistency with master prompt
    const riskScore = 100 - result.trustScore;
    return riskScore > threshold;
  } catch {
    return false; // Fail open — don't block swaps when scanner is unavailable
  }
}
