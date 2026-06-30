import 'server-only';
import {
  decodeAbiParameters,
  parseAbiParameters,
  getAddress,
  isAddress,
  type AbiParameter,
} from 'viem';

/**
 * Raw-calldata decoder with a free public-registry fallback.
 *
 * Primary decode path lives in goplusService (GoPlus ABI input_decode). This
 * module is the fallback that runs when GoPlus has no ABI match: it resolves
 * the 4-byte selector against the two free, no-key signature registries
 * (4byte.directory and OpenChain / samczsun), then uses viem locally to decode
 * the argument blob against the resolved signature. No value is fabricated: if
 * neither registry knows the selector, we say so honestly.
 */

const FOURBYTE = 'https://www.4byte.directory/api/v1/signatures/';
const OPENCHAIN = 'https://api.openchain.xyz/signature-database/v1/lookup';
const TIMEOUT_MS = 8000;

const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

export interface CalldataParam {
  name: string;
  type: string;
  value: string;
}

export interface CalldataDecodeResult {
  mode: 'calldata';
  selector: string;
  /** Where the signature came from, for honest provenance. */
  source: '4byte.directory' | 'OpenChain' | 'none';
  functionName: string;
  signature: string | null;
  humanReadable: string;
  params: CalldataParam[];
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  riskFlags: string[];
  summary: string;
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Resolve a 4-byte selector to a text signature using 4byte.directory first,
 * then OpenChain. 4byte returns multiple candidates ordered by id; the lowest
 * id (earliest submission) is the canonical one for well-known functions.
 */
async function resolveSelector(
  selector: string
): Promise<{ signature: string; source: '4byte.directory' | 'OpenChain' } | null> {
  // 4byte.directory
  const fb = (await getJson(`${FOURBYTE}?hex_signature=${selector}`)) as
    | { results?: { id: number; text_signature: string }[] }
    | null;
  if (fb?.results && fb.results.length > 0) {
    const best = [...fb.results].sort((a, b) => a.id - b.id)[0];
    if (best?.text_signature) {
      return { signature: best.text_signature, source: '4byte.directory' };
    }
  }

  // OpenChain (samczsun) fallback
  const oc = (await getJson(`${OPENCHAIN}?function=${selector}&filter=true`)) as
    | { result?: { function?: Record<string, { name: string }[]> } }
    | null;
  const candidates = oc?.result?.function?.[selector];
  if (candidates && candidates.length > 0 && candidates[0]?.name) {
    return { signature: candidates[0].name, source: 'OpenChain' };
  }

  return null;
}

/** Parse "approve(address,uint256)" → ["address","uint256"] and the name. */
function splitSignature(sig: string): { name: string; typesStr: string } {
  const open = sig.indexOf('(');
  if (open === -1) return { name: sig, typesStr: '' };
  const name = sig.slice(0, open);
  const typesStr = sig.slice(open + 1, sig.lastIndexOf(')'));
  return { name, typesStr };
}

function checksum(v: string): string {
  try {
    return isAddress(v) ? getAddress(v) : v;
  } catch {
    return v;
  }
}

function stringifyValue(v: unknown): string {
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string') return checksum(v);
  if (Array.isArray(v)) return `[${v.map(stringifyValue).join(', ')}]`;
  if (v === null || v === undefined) return '';
  return String(v);
}

/** Decode the argument blob with viem against a resolved abi-parameter string. */
function decodeArgs(typesStr: string, argHex: `0x${string}`): CalldataParam[] {
  if (!typesStr.trim()) return [];
  let abiParams: readonly AbiParameter[];
  try {
    abiParams = parseAbiParameters(typesStr);
  } catch {
    return [];
  }
  try {
    const values = decodeAbiParameters(abiParams, argHex);
    return abiParams.map((p, i) => ({
      name: p.name || `arg${i}`,
      type: p.type,
      value: stringifyValue(values[i]),
    }));
  } catch {
    // Signature resolved but the blob does not match its arity/types: report
    // the shape without fabricated values.
    return abiParams.map((p, i) => ({
      name: p.name || `arg${i}`,
      type: p.type,
      value: '(could not decode from calldata)',
    }));
  }
}

const DANGER_SELECTORS: Record<string, string> = {
  '0x095ea7b3': 'approve',
  '0xa22cb465': 'setApprovalForAll',
  '0x23b872dd': 'transferFrom',
  '0x42842e0e': 'safeTransferFrom',
  '0xb88d4fde': 'safeTransferFrom',
  '0xf2fde38b': 'transferOwnership',
  '0x39509351': 'increaseAllowance',
};

function buildRiskFlags(
  selector: string,
  name: string,
  params: CalldataParam[]
): { flags: string[]; level: CalldataDecodeResult['riskLevel'] } {
  const flags: string[] = [];
  const lname = name.toLowerCase();

  if (selector === '0xa22cb465' || lname === 'setapprovalforall') {
    const approved = params.find((p) => p.type === 'bool');
    if (!approved || approved.value === 'true') {
      flags.push('setApprovalForAll(true): grants an operator control over ALL your NFTs in this collection. A top NFT-drain vector.');
    }
  }
  if (selector === '0x095ea7b3' || lname === 'approve') {
    flags.push('Token approval: grants a spender permission to move this token on your behalf');
    const amt = params.find((p) => p.name.toLowerCase().includes('amount') || p.name.toLowerCase().includes('value') || p.type.startsWith('uint'));
    if (amt && amt.value === MAX_UINT256) {
      flags.push('Unlimited approval (max uint256): the spender can move your entire balance until you revoke');
    }
  }
  if (lname.includes('increaseallowance')) {
    flags.push('Increases an existing token allowance for a spender');
  }
  if (selector === '0x23b872dd' || selector === '0x42842e0e' || selector === '0xb88d4fde' || lname.includes('transferfrom')) {
    flags.push('Transfers tokens or an NFT out of an address on its behalf');
  }
  if (lname.includes('transferownership')) {
    flags.push('Transfers contract ownership to another address');
  }
  if (lname.includes('permit')) {
    flags.push('Embeds a gas-less permit: a signature-based approval inside the call');
  }
  if (lname.includes('multicall') || lname.includes('execute') || lname.includes('aggregate')) {
    flags.push('Batched/aggregated call: bundles multiple actions; inspect each sub-call before signing');
  }

  let level: CalldataDecodeResult['riskLevel'] = flags.length > 0 ? 'WARNING' : 'SAFE';
  if (flags.some((f) => f.includes('Unlimited') || f.includes('ALL your NFTs'))) level = 'DANGER';
  return { flags, level };
}

/**
 * Decode raw calldata using the public signature registries + viem. The caller
 * passes a 0x-prefixed hex string. Returns an honest "cannot decode" result
 * when the selector is unknown to both registries.
 */
export async function decodeCalldataWithRegistries(
  clean: string
): Promise<CalldataDecodeResult> {
  const selector = clean.slice(0, 10).toLowerCase();
  const argHex = ('0x' + clean.slice(10)) as `0x${string}`;

  const resolved = await resolveSelector(selector);

  if (!resolved) {
    return {
      mode: 'calldata',
      selector,
      source: 'none',
      functionName: 'Unknown function',
      signature: null,
      humanReadable: `${selector} (selector not found in 4byte.directory or OpenChain)`,
      params: [],
      riskLevel: 'WARNING',
      riskFlags: [
        'Selector is not in any public signature registry. Cannot confirm what this function does. Do not sign unless you independently verify the contract and method.',
      ],
      summary: `The 4-byte selector ${selector} could not be resolved by GoPlus, 4byte.directory, or OpenChain. Signature Insight cannot decode this call. Treat unknown calls as high risk.`,
    };
  }

  const { name, typesStr } = splitSignature(resolved.signature);
  const params = decodeArgs(typesStr, argHex);
  const { flags, level } = buildRiskFlags(selector, name, params);

  return {
    mode: 'calldata',
    selector,
    source: resolved.source,
    functionName: name,
    signature: resolved.signature,
    humanReadable: resolved.signature,
    params,
    riskLevel: level,
    riskFlags: flags,
    summary:
      flags.length > 0
        ? `This calldata calls ${name}() (resolved via ${resolved.source}) and carries ${flags.length} risk flag(s). Review them before signing.`
        : `This calldata calls ${name}() (resolved via ${resolved.source}). No standard high-risk pattern detected, but always verify the target contract.`,
  };
}

export { DANGER_SELECTORS };
