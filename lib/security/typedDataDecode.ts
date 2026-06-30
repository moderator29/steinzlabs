import 'server-only';
import {
  hashTypedData,
  isAddress,
  getAddress,
  type TypedDataDomain,
} from 'viem';

/**
 * EIP-712 typed-data decoder: fully local, no network.
 *
 * Gas-less off-chain signatures (Permit, Permit2, Seaport orders) are the
 * dominant wallet-drain vector: the victim signs a structured message that
 * looks harmless in a wallet prompt, and the attacker later submits it
 * on-chain to move tokens. Unlike a transaction, nothing is simulated by the
 * wallet, so the only defense is reading the typed data itself.
 *
 * This module parses a raw EIP-712 payload (the JSON the dApp passes to
 * eth_signTypedData_v4), recognizes the well-known drain shapes, and surfaces
 * exactly which spender is being granted what: using viem locally to also
 * recompute the EIP-712 digest the wallet would sign, so the user can verify
 * the hash. No value is ever fabricated; unrecognized shapes are reported as
 * a generic typed-data message with an honest "structure unknown" note.
 */

export interface TypedDataField {
  name: string;
  type: string;
  value: string;
}

export interface TypedDataDecodeResult {
  mode: 'typed-data';
  primaryType: string;
  /** Human label for the recognized standard, or a generic fallback. */
  standard:
    | 'ERC-2612 Permit'
    | 'Permit2 (single)'
    | 'Permit2 (batch)'
    | 'Seaport Order'
    | 'DAI-style Permit'
    | 'Typed Message';
  functionName: string;
  humanReadable: string;
  /** Domain fields (name, version, chainId, verifyingContract). */
  domain: { name: string; type: string; value: string }[];
  /** Flattened message fields. */
  params: TypedDataField[];
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  riskFlags: string[];
  summary: string;
  /** The EIP-712 digest the wallet signs, recomputed locally with viem. */
  eip712Digest: string | null;
  /** Key actors extracted for the asset-diff / spender callouts. */
  spender: string | null;
  /** Expiry / deadline as a unix-seconds string when present. */
  deadline: string | null;
}

const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';
const MAX_UINT160 = '1461501637330902918203684832716283019655932542975';

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** Pretty-print a deadline/expiration unix timestamp into a relative note. */
function describeDeadline(raw: string): string | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Permit2 uses type(uint48).max for "no expiration".
  if (raw === '281474976710655' || raw === MAX_UINT256) return 'never expires';
  const ms = n * 1000;
  if (ms < Date.now()) return 'already expired';
  return `expires ${new Date(ms).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

function isUnlimited(v: string): boolean {
  return v === MAX_UINT256 || v === MAX_UINT160;
}

/** Flatten a message object one level deep into name/type/value rows. */
function flattenMessage(
  message: Record<string, unknown>,
  typeFields: { name: string; type: string }[] | undefined
): TypedDataField[] {
  if (typeFields && typeFields.length) {
    return typeFields.map((f) => ({
      name: f.name,
      type: f.type,
      value: asString((message as Record<string, unknown>)[f.name]),
    }));
  }
  return Object.entries(message).map(([k, v]) => ({
    name: k,
    type: typeof v === 'number' || typeof v === 'bigint' ? 'uint256' : 'unknown',
    value: asString(v),
  }));
}

interface RawTypedData {
  domain?: TypedDataDomain & Record<string, unknown>;
  primaryType?: string;
  types?: Record<string, { name: string; type: string }[]>;
  message?: Record<string, unknown>;
}

/**
 * Parse a possibly-stringified EIP-712 payload into a normalized object.
 * Returns null if it does not look like typed data at all.
 */
export function parseTypedDataInput(input: string): RawTypedData | null {
  let obj: unknown;
  try {
    obj = JSON.parse(input);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as RawTypedData;
  // Minimal EIP-712 shape: must have types + primaryType + message, or domain.
  if (!o.message && !o.domain) return null;
  if (!o.primaryType && !o.types) return null;
  return o;
}

/** Recompute the EIP-712 digest locally with viem; null on any structural error. */
function computeDigest(raw: RawTypedData): string | null {
  try {
    if (!raw.types || !raw.primaryType || !raw.message) return null;
    // viem requires an EIP712Domain entry to be present in `types` OR a domain
    // object; it derives the domain type from the domain keys when omitted.
    const types = { ...raw.types };
    delete (types as Record<string, unknown>).EIP712Domain;
    return hashTypedData({
      domain: raw.domain ?? {},
      types: types as Record<string, { name: string; type: string }[]>,
      primaryType: raw.primaryType,
      message: raw.message,
    });
  } catch {
    return null;
  }
}

function safeChecksum(addr: string): string {
  try {
    return isAddress(addr) ? getAddress(addr) : addr;
  } catch {
    return addr;
  }
}

/**
 * Decode a normalized EIP-712 payload into a risk-annotated result.
 * Recognizes ERC-2612 Permit, DAI permit, Permit2 single/batch, and Seaport.
 */
export function decodeTypedData(raw: RawTypedData): TypedDataDecodeResult {
  const primaryType = raw.primaryType ?? 'Message';
  const message = (raw.message ?? {}) as Record<string, unknown>;
  const typeFields = raw.types?.[primaryType];

  const domain: { name: string; type: string; value: string }[] = [];
  if (raw.domain) {
    for (const [k, v] of Object.entries(raw.domain)) {
      domain.push({
        name: k,
        type: k === 'chainId' ? 'uint256' : k === 'verifyingContract' ? 'address' : 'string',
        value: k === 'verifyingContract' ? safeChecksum(asString(v)) : asString(v),
      });
    }
  }

  const params = flattenMessage(message, typeFields).map((p) =>
    p.type === 'address' && isAddress(p.value)
      ? { ...p, value: safeChecksum(p.value) }
      : p
  );

  const eip712Digest = computeDigest(raw);
  const riskFlags: string[] = [];
  let standard: TypedDataDecodeResult['standard'] = 'Typed Message';
  let spender: string | null = null;
  let deadline: string | null = null;
  let summary = '';

  const lower = primaryType.toLowerCase();
  const verifyingContract = asString(raw.domain?.verifyingContract);
  const domainName = asString(raw.domain?.name);

  // ── Permit2 (Uniswap) ──────────────────────────────────────────────────────
  if (lower === 'permitsingle' || lower === 'permitdetails') {
    standard = 'Permit2 (single)';
    const details = (message.details ?? message) as Record<string, unknown>;
    const token = safeChecksum(asString(details.token));
    const amount = asString(details.amount);
    spender = safeChecksum(asString(message.spender ?? details.spender ?? ''));
    const expiration = asString(details.expiration);
    deadline = expiration || asString(message.sigDeadline) || null;
    const exp = describeDeadline(expiration);
    riskFlags.push('Permit2 approval: grants a spender permission to move your tokens off-chain, no on-chain transaction needed');
    if (isUnlimited(amount)) riskFlags.push('Unlimited amount (max allowance): the spender can move your entire balance of this token');
    if (exp === 'never expires') riskFlags.push('No expiration: this approval never auto-revokes');
    summary = `Permit2 single approval of token ${token || 'unknown'} to spender ${spender || 'unknown'}${exp ? `, ${exp}` : ''}. Anyone holding this signature can pull the approved amount on-chain.`;
  } else if (lower === 'permitbatch') {
    standard = 'Permit2 (batch)';
    spender = safeChecksum(asString(message.spender ?? ''));
    deadline = asString(message.sigDeadline) || null;
    const detailsArr = Array.isArray(message.details) ? message.details : [];
    riskFlags.push(`Permit2 BATCH approval: grants one spender permission over ${detailsArr.length || 'multiple'} token(s) in a single signature`);
    if (detailsArr.some((d) => isUnlimited(asString((d as Record<string, unknown>).amount)))) {
      riskFlags.push('At least one token approved for an unlimited amount');
    }
    summary = `Permit2 batch approval granting spender ${spender || 'unknown'} access to ${detailsArr.length || 'multiple'} tokens at once. Batch permits are a common drainer pattern.`;
  }
  // ── ERC-2612 / DAI permit ──────────────────────────────────────────────────
  else if (lower === 'permit') {
    const value = asString(message.value);
    const allowed = message.allowed;
    spender = safeChecksum(asString(message.spender ?? ''));
    deadline = asString(message.deadline ?? message.expiry) || null;
    const exp = describeDeadline(asString(message.deadline ?? message.expiry ?? ''));
    if (allowed !== undefined || message.value === undefined) {
      standard = 'DAI-style Permit';
      riskFlags.push('DAI-style permit: a boolean "allowed" grants unlimited spend of this token to the spender');
      summary = `DAI-style permit granting spender ${spender || 'unknown'} unlimited allowance over token ${safeChecksum(verifyingContract) || domainName || 'unknown'}${exp ? `, ${exp}` : ''}.`;
    } else {
      standard = 'ERC-2612 Permit';
      riskFlags.push('Gas-less token approval (ERC-2612 permit): grants a spender allowance with just your signature, no on-chain approve');
      if (isUnlimited(value)) riskFlags.push('Unlimited allowance (max uint256): the spender can move your entire balance of this token');
      summary = `ERC-2612 permit on ${domainName || safeChecksum(verifyingContract) || 'a token'} granting spender ${spender || 'unknown'} an allowance of ${isUnlimited(value) ? 'UNLIMITED' : value || 'unknown'}${exp ? `, ${exp}` : ''}.`;
    }
    if (exp === 'never expires') riskFlags.push('No expiration deadline');
  }
  // ── Seaport (OpenSea) order ────────────────────────────────────────────────
  else if (lower === 'ordercomponents' || lower === 'order' || domainName.toLowerCase().includes('seaport')) {
    standard = 'Seaport Order';
    const offer = Array.isArray(message.offer) ? message.offer : [];
    const consideration = Array.isArray(message.consideration) ? message.consideration : [];
    spender = safeChecksum(asString(message.zone ?? ''));
    deadline = asString(message.endTime) || null;
    riskFlags.push('Seaport order signature: authorizes an NFT/token trade that can be fulfilled by anyone holding this signature');
    if (offer.length > 0 && consideration.length === 0) {
      riskFlags.push('Order OFFERS assets with NO consideration back to you: this can transfer your NFTs/tokens for nothing');
    }
    summary = `Seaport order offering ${offer.length} item(s) in exchange for ${consideration.length} consideration item(s). Verify the consideration actually pays you; zero-consideration orders are theft.`;
  } else {
    summary = `Typed-data message of type "${primaryType}"${domainName ? ` from ${domainName}` : ''}. The structure is not a recognized approval standard; read every field carefully before signing.`;
    riskFlags.push('Unrecognized typed-data structure: Signature Insight cannot map this to a known approval shape, so review each field manually');
  }

  // Cross-cutting: unknown verifying contract for an approval primitive.
  if ((standard === 'Permit2 (single)' || standard === 'Permit2 (batch)') && verifyingContract) {
    // Canonical Permit2 contract is the same across chains.
    const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
    if (safeChecksum(verifyingContract).toLowerCase() !== PERMIT2.toLowerCase()) {
      riskFlags.push('Verifying contract is NOT the canonical Permit2 address: possible spoofed Permit2 domain');
    }
  }

  let riskLevel: TypedDataDecodeResult['riskLevel'] = 'WARNING';
  const flagText = riskFlags.join(' ').toLowerCase();
  if (
    flagText.includes('unlimited') ||
    flagText.includes('batch') ||
    flagText.includes('no consideration') ||
    flagText.includes('spoofed') ||
    flagText.includes('never auto-revoke') ||
    flagText.includes('never expires')
  ) {
    riskLevel = 'DANGER';
  } else if (standard === 'Typed Message') {
    riskLevel = 'WARNING';
  }

  return {
    mode: 'typed-data',
    primaryType,
    standard,
    functionName: standard,
    humanReadable: `${primaryType}(${params.map((p) => `${p.type} ${p.name}`).join(', ')})`,
    domain,
    params,
    riskLevel,
    riskFlags,
    summary,
    eip712Digest,
    spender,
    deadline,
  };
}
