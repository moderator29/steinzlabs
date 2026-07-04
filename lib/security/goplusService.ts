/**
 * Security Intelligence Service
 * Internal security data provider — backend only, never expose provider name in UI
 */

import { normalizeAddress } from '@/lib/utils/addressNormalize';

const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1';
const API_KEY = process.env.GOPLUS_API_KEY || '';
const TIMEOUT_MS = parseInt(process.env.GOPLUS_TIMEOUT_MS || '15000', 10);

const CHAIN_MAP: Record<string, string> = {
  ethereum: '1', eth: '1',
  bsc: '56', bnb: '56',
  polygon: '137', matic: '137',
  solana: 'solana', sol: 'solana',
  base: '8453',
  avalanche: '43114', avax: '43114',
  arbitrum: '42161', arb: '42161',
  optimism: '10', op: '10',
  '1': '1', '56': '56', '137': '137',
  '8453': '8453', '43114': '43114',
  '42161': '42161', '10': '10',
};

function resolveChainId(chain: string): string {
  return CHAIN_MAP[chain.toLowerCase()] ?? chain;
}

export class SecurityRateLimitError extends Error {
  constructor() { super('Security API rate-limited'); this.name = 'SecurityRateLimitError'; }
}

async function goplusGet(path: string): Promise<any> {
  const url = `${GOPLUS_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: API_KEY },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // #39: surface 429 as a typed error so callers can return a "temporarily
  // unavailable, retry shortly" state instead of collapsing it into a hidden/
  // empty panel that reads like "no data".
  if (res.status === 429) throw new SecurityRateLimitError();
  if (!res.ok) throw new Error(`Security API error: ${res.status}`);
  const data = await res.json();
  if (data.code !== undefined && data.code !== 1) {
    throw new Error(data.message || 'Security API returned error');
  }
  return data.result ?? data;
}

// ─── Token Security ────────────────────────────────────────────────────────────

export interface TokenSecurityResult {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  isMintable: boolean;
  isProxy: boolean;
  hasHiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  ownerCanChangeBalance: boolean;
  selfDestruct: boolean;
  externalCall: boolean;
  cannotBuy: boolean;
  cannotSellAll: boolean;
  tradingCooldown: boolean;
  /** Solana SPL only: an active freeze authority can freeze token accounts
   *  (block transfers) — a real but distinct risk from EVM balance-modification.
   *  Kept separate so we never mislabel a freezable SPL (e.g. USDC) as
   *  "owner can change your balance". */
  freezable?: boolean;
  /** Solana SPL only: the token account can be closed by an authority. */
  closable?: boolean;
  creatorAddress: string;
  ownerAddress: string;
  /** True when the creator wallet sits in the top-N holders with a
   *  meaningful share — a strong dump-risk indicator. */
  creatorIsTopHolder: boolean;
  /** Creator's own holdings as a fraction of supply (0..1). */
  creatorHoldingPct: number;
  /** LARGEST single holder's share of supply (0..1) — the real concentration
   *  signal. Distinct from creatorHoldingPct, which is only the dev wallet. */
  topHolderPct: number;
  holderCount: number;
  lpHolders: any[];
  trustScore: number;
  safetyLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
  safetyColor: string;
  checks: { label: string; status: 'pass' | 'fail' | 'warn' }[];
  raw: any;
}

export async function scanTokenSecurity(
  contractAddress: string,
  chain: string
): Promise<TokenSecurityResult> {
  const isSolana = chain.toLowerCase() === 'solana' || chain.toLowerCase() === 'sol';

  // Solana mints live at a different GoPlus path with a different
  // payload shape (mintable.status, freezable.status, transfer_fee,
  // etc — nested objects, not "1"/"0" flag strings). The old code
  // routed Solana into the EVM path, so the parser silently produced
  // empty fact rows for every SPL.
  if (isSolana) {
    const data = await goplusGet(
      `/solana/token_security/?contract_addresses=${contractAddress}`
    );
    const t = data[contractAddress] ?? Object.values(data)[0] ?? {};
    return parseSolanaTokenSecurity(t);
  }

  const chainId = resolveChainId(chain);
  const data = await goplusGet(
    `/token_security/${chainId}?contract_addresses=${contractAddress}`
  );
  // GoPlus indexes EVM responses by lowercased address; normalizeAddress
  // returns the lower-case form for EVM and preserves Solana case.
  const key = normalizeAddress(contractAddress, chain);
  const t = data[key] ?? data[contractAddress] ?? Object.values(data)[0] ?? {};
  return parseTokenSecurity(t);
}

/**
 * Parse the Solana-specific GoPlus payload into the shared
 * TokenSecurityResult shape so SecurityPanel + portfolio-risk can
 * render uniformly across chains. Solana fields are nested objects
 * with `.status` properties, not flat "1"/"0" strings.
 */
function parseSolanaTokenSecurity(t: Record<string, unknown>): TokenSecurityResult {
  const status = (v: unknown): boolean => {
    if (v && typeof v === 'object' && 'status' in v) {
      const s = (v as { status: unknown }).status;
      return s === '1' || s === 1 || s === true;
    }
    return v === '1' || v === 1 || v === true;
  };
  const isMintable = status(t.mintable);
  const isFreezable = status(t.freezable);
  const isClosable = status(t.closable);
  const nonTransferable = status(t.non_transferable);
  const metadataMutable = status(t.metadata_mutable);

  let score = 100;
  if (isMintable) score -= 20;
  if (isFreezable) score -= 20;
  if (isClosable) score -= 10;
  if (nonTransferable) score -= 40;
  if (metadataMutable) score -= 5;
  score = Math.max(0, Math.min(100, score));

  let safetyLevel: TokenSecurityResult['safetyLevel'] = 'SAFE';
  let safetyColor = '#10B981';
  if (score < 30) { safetyLevel = 'DANGER'; safetyColor = '#EF4444'; }
  else if (score < 50) { safetyLevel = 'WARNING'; safetyColor = '#F59E0B'; }
  else if (score < 70) { safetyLevel = 'CAUTION'; safetyColor = '#F59E0B'; }

  const checks: { label: string; status: 'pass' | 'fail' | 'warn' }[] = [
    { label: 'Mint Authority Renounced', status: isMintable ? 'fail' : 'pass' },
    { label: 'Freeze Authority Renounced', status: isFreezable ? 'fail' : 'pass' },
    { label: 'Account Not Closable', status: isClosable ? 'warn' : 'pass' },
    { label: 'Transferable', status: nonTransferable ? 'fail' : 'pass' },
    { label: 'Metadata Immutable', status: metadataMutable ? 'warn' : 'pass' },
  ];

  const holders = Array.isArray(t.holders) ? t.holders : [];

  return {
    isHoneypot: nonTransferable,
    buyTax: 0,
    sellTax: 0,
    isOpenSource: true, // Not surfaced by GoPlus Solana — assume native programs
    isMintable,
    isProxy: false,
    hasHiddenOwner: false,
    canTakeBackOwnership: false,
    // SPL freeze authority is NOT arbitrary balance modification (that's an EVM
    // concept). Surface it via the dedicated `freezable` field + the checks
    // list, not by mislabeling it 'owner can change balance' — which wrongly
    // flagged legitimate freezable tokens (USDC, etc.) as balance-rug risks.
    ownerCanChangeBalance: false,
    // Account-closable ≠ contract self-destruct; keep it in `closable`.
    selfDestruct: false,
    freezable: isFreezable,
    closable: isClosable,
    externalCall: false,
    cannotBuy: false,
    cannotSellAll: nonTransferable,
    tradingCooldown: false,
    creatorAddress: typeof t.creator_address === 'string' ? t.creator_address : '',
    ownerAddress: '',
    holderCount: typeof t.holder_count === 'string' ? parseInt(t.holder_count) : (typeof t.holder_count === 'number' ? t.holder_count : 0),
    lpHolders: Array.isArray(t.lp_holders) ? t.lp_holders : [],
    creatorIsTopHolder: false,
    creatorHoldingPct: 0,
    topHolderPct: holders.reduce((m: number, h: Record<string, unknown>) => Math.max(m, parseFloat(String(h.percent ?? '0')) || 0), 0),
    trustScore: score,
    safetyLevel,
    safetyColor,
    checks,
    raw: { ...t, _holders: holders },
  };
}

function parseTokenSecurity(t: any): TokenSecurityResult {
  const buyTax = parseFloat(t.buy_tax || '0');
  const sellTax = parseFloat(t.sell_tax || '0');

  // Dev-wallet auto-block heuristic: GoPlus returns the creator address
  // and (when available) the top-10 holders. If the creator sits in
  // that list with a non-trivial share, the snipe should be blocked —
  // historically dev wallets at >2% of supply correlate with dump
  // events within minutes of liquidity add.
  const creatorAddrRaw = String(t.creator_address || '');
  const creatorAddr = creatorAddrRaw.toLowerCase();
  const topHolders: Array<Record<string, unknown>> = Array.isArray(t.holders) ? t.holders : [];
  let creatorIsTopHolder = false;
  let creatorHoldingPct = 0;
  if (creatorAddr) {
    for (const h of topHolders) {
      const addr = String(h.address ?? '').toLowerCase();
      if (addr && addr === creatorAddr) {
        creatorIsTopHolder = true;
        creatorHoldingPct = parseFloat(String(h.percent ?? '0')) || 0;
        break;
      }
    }
  }

  let score = 100;
  if (t.is_honeypot === '1') score -= 40;
  if (t.is_open_source !== '1') score -= 15;
  if (t.is_proxy === '1') score -= 10;
  if (t.is_mintable === '1') score -= 10;
  if (t.can_take_back_ownership === '1') score -= 15;
  if (t.owner_change_balance === '1') score -= 15;
  if (t.hidden_owner === '1') score -= 10;
  if (t.selfdestruct === '1') score -= 10;
  if (t.external_call === '1') score -= 5;
  if (t.cannot_buy === '1') score -= 20;
  if (t.cannot_sell_all === '1') score -= 15;
  if (buyTax > 0.1) score -= 10;
  else if (buyTax > 0.05) score -= 5;
  if (sellTax > 0.1) score -= 10;
  else if (sellTax > 0.05) score -= 5;
  // Dev-wallet concentration penalty. A creator holding >5% is a hard
  // dump-risk red flag (-20); >2% is concerning (-10). Lower exposure
  // is still surfaced via creatorIsTopHolder so sniper-side rules can
  // see it without losing the score signal.
  if (creatorIsTopHolder && creatorHoldingPct > 0.05) score -= 20;
  else if (creatorIsTopHolder && creatorHoldingPct > 0.02) score -= 10;
  score = Math.max(0, Math.min(100, score));

  // §audit false-SAFE guard. GoPlus omits the dynamic sell-simulation fields
  // (is_honeypot, buy/sell tax, cannot_sell_all) for brand-new tokens with no
  // tradable pool yet — exactly the feed's population. Treating "absent" as
  // "passed" let unanalyzed tokens surface SAFE (the dangerous direction).
  // When the honeypot sim hasn't run, cap the rating at CAUTION and never SAFE.
  const honeypotUnknown = t.is_honeypot === undefined || t.is_honeypot === null || t.is_honeypot === '';
  if (honeypotUnknown && score >= 70) score = 69; // force at most CAUTION

  let safetyLevel: TokenSecurityResult['safetyLevel'] = 'SAFE';
  let safetyColor = '#10B981';
  if (score < 30) { safetyLevel = 'DANGER'; safetyColor = '#EF4444'; }
  else if (score < 50) { safetyLevel = 'WARNING'; safetyColor = '#F59E0B'; }
  else if (score < 70) { safetyLevel = 'CAUTION'; safetyColor = '#F59E0B'; }

  const checks: { label: string; status: 'pass' | 'fail' | 'warn' }[] = [
    { label: 'Contract Verified', status: t.is_open_source === '1' ? 'pass' : 'fail' },
    { label: honeypotUnknown ? 'Honeypot (dynamic checks unavailable)' : 'No Honeypot', status: t.is_honeypot === '1' ? 'fail' : honeypotUnknown ? 'warn' : 'pass' },
    { label: 'Ownership Renounced', status: t.owner_address === '' || t.owner_address === '0x0000000000000000000000000000000000000000' ? 'pass' : t.can_take_back_ownership === '1' ? 'fail' : 'warn' },
    { label: 'No Mint Function', status: t.is_mintable === '1' ? 'fail' : 'pass' },
    { label: 'No Proxy', status: t.is_proxy === '1' ? 'warn' : 'pass' },
    { label: 'No Hidden Owner', status: t.hidden_owner === '1' ? 'fail' : 'pass' },
    { label: 'No Self-Destruct', status: t.selfdestruct === '1' ? 'fail' : 'pass' },
    { label: 'Can Sell All', status: t.cannot_sell_all === '1' ? 'fail' : 'pass' },
    { label: 'Buy Tax Under 10%', status: buyTax > 0.1 ? 'fail' : buyTax > 0.05 ? 'warn' : 'pass' },
    { label: 'Sell Tax Under 10%', status: sellTax > 0.1 ? 'fail' : sellTax > 0.05 ? 'warn' : 'pass' },
    {
      label: 'Dev wallet not in top holders',
      status:
        creatorIsTopHolder && creatorHoldingPct > 0.05
          ? 'fail'
          : creatorIsTopHolder && creatorHoldingPct > 0.02
            ? 'warn'
            : 'pass',
    },
  ];

  return {
    isHoneypot: t.is_honeypot === '1',
    buyTax,
    sellTax,
    isOpenSource: t.is_open_source === '1',
    isMintable: t.is_mintable === '1',
    isProxy: t.is_proxy === '1',
    hasHiddenOwner: t.hidden_owner === '1',
    canTakeBackOwnership: t.can_take_back_ownership === '1',
    ownerCanChangeBalance: t.owner_change_balance === '1',
    selfDestruct: t.selfdestruct === '1',
    externalCall: t.external_call === '1',
    cannotBuy: t.cannot_buy === '1',
    cannotSellAll: t.cannot_sell_all === '1',
    tradingCooldown: t.trading_cooldown === '1',
    creatorAddress: t.creator_address || '',
    ownerAddress: t.owner_address || '',
    creatorIsTopHolder,
    creatorHoldingPct,
    // Largest single holder's share (0..1) — the true concentration metric,
    // computed from the full holders list rather than just the creator wallet.
    topHolderPct: topHolders.reduce((m, h) => Math.max(m, parseFloat(String(h.percent ?? '0')) || 0), 0),
    holderCount: parseInt(t.holder_count || '0'),
    lpHolders: t.lp_holders || [],
    trustScore: score,
    safetyLevel,
    safetyColor,
    checks,
    raw: t,
  };
}

// ─── Address (Wallet) Security Scan ───────────────────────────────────────────

export interface AddressScanResult {
  isBlacklisted: boolean;
  isMalicious: boolean;
  isPhishing: boolean;
  isMixer: boolean;
  isContract: boolean;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  labels: string[];
  description: string;
}

export async function scanAddress(
  address: string,
  chain: string
): Promise<AddressScanResult> {
  try {
    const chainId = resolveChainId(chain);
    const data = await goplusGet(
      `/address_security/${address}?chain_id=${chainId}`
    );
    return parseAddressScan(data);
  } catch {
    return {
      isBlacklisted: false, isMalicious: false, isPhishing: false,
      isMixer: false, isContract: false, riskLevel: 'SAFE', riskScore: 0,
      labels: [], description: 'Unable to scan address',
    };
  }
}

function parseAddressScan(d: any): AddressScanResult {
  const labels: string[] = [];
  if (d.blacklist_doubt === '1') labels.push('blacklist');
  if (d.phishing_activities === '1') labels.push('phishing');
  if (d.honeypot_related_address === '1') labels.push('honeypot-related');
  if (d.stealing_attack === '1') labels.push('stealing-attack');
  if (d.fake_kyc === '1') labels.push('fake-kyc');
  if (d.malicious_mining_activities === '1') labels.push('malicious-mining');
  if (d.mixer === '1') labels.push('mixer');
  if (d.darkweb_transactions === '1') labels.push('darkweb');
  if (d.cybercrime === '1') labels.push('cybercrime');
  if (d.money_laundering === '1') labels.push('money-laundering');
  if (d.financial_crime === '1') labels.push('financial-crime');

  const isMalicious = d.phishing_activities === '1' || d.stealing_attack === '1' || d.cybercrime === '1';
  const isPhishing = d.phishing_activities === '1';
  const isMixer = d.mixer === '1';
  const isBlacklisted = d.blacklist_doubt === '1';
  const isContract = d.contract_address === '1';

  let riskScore = 0;
  if (isMalicious) riskScore += 80;
  else if (isBlacklisted) riskScore += 60;
  else if (isMixer) riskScore += 40;
  else if (labels.length > 0) riskScore += labels.length * 15;

  riskScore = Math.min(100, riskScore);
  let riskLevel: AddressScanResult['riskLevel'] = 'SAFE';
  if (riskScore >= 80) riskLevel = 'CRITICAL';
  else if (riskScore >= 60) riskLevel = 'HIGH';
  else if (riskScore >= 40) riskLevel = 'MEDIUM';
  else if (riskScore >= 15) riskLevel = 'LOW';

  return {
    isBlacklisted, isMalicious, isPhishing, isMixer, isContract,
    riskLevel, riskScore, labels,
    description: labels.length > 0
      ? `Address flagged: ${labels.join(', ')}`
      : 'No threats detected',
  };
}

// ─── Phishing / Domain Detection ──────────────────────────────────────────────

export interface DomainScanResult {
  verdict: 'SAFE' | 'SUSPICIOUS' | 'PHISHING';
  confidenceScore: number;
  isPhishing: boolean;
  isMalicious: boolean;
  description: string;
  signals: string[];
}

export async function scanDomain(url: string): Promise<DomainScanResult> {
  // This THROWS by design when the phishing-intel provider is unreachable.
  // Callers MUST fail open to an 'unknown'/unavailable state, never to a clean
  // pass — mirroring simulateTransaction's fail-closed contract in this file.
  // Previously it swallowed the error and returned heuristicDomainScan()'s
  // SAFE/85 verdict, which the Domain Shield reported as an authoritative
  // "Phishing intelligence: clean" result during an outage. That fabricated
  // confidence and is forbidden by CLAUDE.md. The heuristic signal is still
  // available, but only via the separately-labeled 'heuristic' source.
  const encoded = encodeURIComponent(url);
  const data = await goplusGet(`/phishing_site?url=${encoded}`);
  return parseDomainScan(data, url);
}

function parseDomainScan(d: any, url: string): DomainScanResult {
  const isPhishing = d.phishing === '1' || d.phishing_type !== undefined;
  const isMalicious = d.malicious === '1';

  const signals: string[] = [];
  if (isPhishing) signals.push('Known phishing site');
  if (isMalicious) signals.push('Malicious activity detected');
  if (d.phishing_type) signals.push(`Type: ${d.phishing_type}`);

  let verdict: DomainScanResult['verdict'] = 'SAFE';
  let confidenceScore = 95;
  if (isPhishing || isMalicious) {
    verdict = 'PHISHING';
    confidenceScore = 98;
  }

  return {
    verdict, confidenceScore, isPhishing, isMalicious,
    description: isPhishing
      ? 'This domain is a known phishing site. Do not interact with it.'
      : isMalicious
      ? 'This domain has been flagged for malicious activity.'
      : 'No threats detected for this domain.',
    signals,
  };
}

// Canonical domains for the brands phishing kits most commonly impersonate.
// A scan against any of these (or their subdomains) short-circuits to SAFE.
const CANONICAL_DOMAINS = new Set([
  'metamask.io', 'uniswap.org', 'app.uniswap.org', 'coinbase.com', 'wallet.coinbase.com',
  'binance.com', 'phantom.app', 'ledger.com', 'opensea.io', 'magiceden.io',
  'rainbow.me', 'trustwallet.com', 'safe.global', 'app.aave.com', 'jup.ag',
]);

/**
 * Local, network-free URL heuristics (brand keywords, suspicious TLDs, raw IP,
 * hyphenated wallet/secure patterns). Exported so Domain Shield can surface it
 * as a clearly-labeled, SEPARATE 'heuristic' source. It is NEVER presented as a
 * phishing-intelligence clean pass: a SAFE heuristic result carries no positive
 * weight, it only ever contributes risk signals.
 */
export function heuristicDomainScan(url: string): DomainScanResult {
  const signals: string[] = [];
  let host = '';
  try {
    host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return {
      verdict: 'SUSPICIOUS', confidenceScore: 50, isPhishing: false, isMalicious: false,
      description: 'URL could not be parsed.',
      signals: ['Malformed URL'],
    };
  }

  for (const canon of CANONICAL_DOMAINS) {
    if (host === canon || host.endsWith(`.${canon}`)) {
      return {
        verdict: 'SAFE', confidenceScore: 99, isPhishing: false, isMalicious: false,
        description: 'Canonical domain — recognized as legitimate.',
        signals: [],
      };
    }
  }

  const PHISHING_PATTERNS = [
    'metamask', 'uniswap', 'coinbase', 'binance', 'phantom', 'ledger',
    'opensea', 'airdrop', 'freeclaim', 'verify-wallet', 'claim-nft',
    'connect-wallet', 'sync-wallet', 'recover-wallet',
  ];
  const SUSPICIOUS_TLDS = ['.xyz', '.click', '.link', '.tk', '.ml'];

  let phishingScore = 0;
  for (const pattern of PHISHING_PATTERNS) {
    if (host.includes(pattern)) {
      signals.push(`Brand keyword in hostname: "${pattern}"`);
      phishingScore += 15;
    }
  }
  for (const tld of SUSPICIOUS_TLDS) {
    if (host.endsWith(tld)) {
      signals.push(`Suspicious TLD: ${tld}`);
      phishingScore += 15;
    }
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    signals.push('Direct IP address (no domain)');
    phishingScore += 30;
  }
  if (host.includes('-') && (host.includes('wallet') || host.includes('secure'))) {
    signals.push('Suspicious hyphenated hostname pattern');
    phishingScore += 10;
  }

  // Require at least 2 signals before escalating to SUSPICIOUS, and 3+
  // before PHISHING, to avoid single-keyword false positives.
  phishingScore = Math.min(100, phishingScore);
  let verdict: DomainScanResult['verdict'] = 'SAFE';
  if (signals.length >= 3 && phishingScore >= 45) verdict = 'PHISHING';
  else if (signals.length >= 2 && phishingScore >= 25) verdict = 'SUSPICIOUS';

  return {
    verdict,
    confidenceScore: verdict === 'SAFE' ? 85 : phishingScore,
    isPhishing: verdict === 'PHISHING',
    isMalicious: phishingScore >= 60,
    description:
      verdict === 'PHISHING'
        ? 'Multiple phishing signals detected. This domain is likely malicious.'
        : verdict === 'SUSPICIOUS'
        ? 'Some suspicious patterns found. Proceed with extreme caution.'
        : 'No obvious threats detected for this domain.',
    signals,
  };
}

// ─── Signature / Transaction Decode ───────────────────────────────────────────

export interface SignatureDecodeResult {
  functionName: string;
  humanReadable: string;
  params: { name: string; type: string; value: string }[];
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  riskFlags: string[];
  summary: string;
}

export async function decodeSignature(
  data: string,
  chain: string
): Promise<SignatureDecodeResult> {
  try {
    const chainId = resolveChainId(chain);
    const result = await goplusGet(
      `/abi/input_decode?chain_id=${chainId}&data=${encodeURIComponent(data)}`
    );
    return parseSignatureDecode(result);
  } catch {
    return localSignatureDecode(data);
  }
}

function parseSignatureDecode(d: any): SignatureDecodeResult {
  const functionName = d.method_name || d.function_name || 'Unknown Function';
  const params = (d.params || d.inputs || []).map((p: any) => ({
    name: p.name || p.param_name || 'unknown',
    type: p.type || p.param_type || 'bytes',
    value: String(p.value || p.param_value || ''),
  }));

  const riskFlags: string[] = [];
  const lname = functionName.toLowerCase();
  if (lname.includes('approve') || lname.includes('setapprovalforall')) riskFlags.push('Token approval — grants spending permission');
  if (lname.includes('transferfrom') || lname.includes('safetransferfrom')) riskFlags.push('Transfer of tokens or NFTs on your behalf');
  if (lname.includes('delegatecall')) riskFlags.push('Delegate call — executes arbitrary code');
  if (lname.includes('selfdestruct') || lname.includes('suicide')) riskFlags.push('Contract destruction function');
  if (lname.includes('setowner') || lname.includes('transferownership')) riskFlags.push('Ownership transfer function');

  // Check for unlimited approvals
  for (const p of params) {
    if ((p.name.toLowerCase().includes('amount') || p.name.toLowerCase().includes('value')) &&
      p.value === '115792089237316195423570985008687907853269984665640564039457584007913129639935') {
      riskFlags.push('Unlimited token approval (max uint256)');
    }
  }

  let riskLevel: SignatureDecodeResult['riskLevel'] = 'SAFE';
  if (riskFlags.some(f => f.includes('Unlimited') || f.includes('Delegate') || f.includes('destruction'))) riskLevel = 'DANGER';
  else if (riskFlags.length > 0) riskLevel = 'WARNING';

  return {
    functionName,
    humanReadable: `${functionName}(${params.map((p: any) => `${p.type} ${p.name}`).join(', ')})`,
    params,
    riskLevel,
    riskFlags,
    summary: riskFlags.length > 0
      ? `This transaction calls ${functionName} and has ${riskFlags.length} risk flag(s).`
      : `This transaction calls ${functionName}. No major risks detected.`,
  };
}

function localSignatureDecode(data: string): SignatureDecodeResult {
  // 4-byte selector lookup for common functions
  const SELECTORS: Record<string, string> = {
    '0x095ea7b3': 'approve(address spender, uint256 amount)',
    '0xa9059cbb': 'transfer(address to, uint256 value)',
    '0x23b872dd': 'transferFrom(address from, address to, uint256 value)',
    '0x40c10f19': 'mint(address to, uint256 amount)',
    '0x42966c68': 'burn(uint256 amount)',
    '0x715018a6': 'renounceOwnership()',
    '0xf2fde38b': 'transferOwnership(address newOwner)',
    '0xa22cb465': 'setApprovalForAll(address operator, bool approved)',
    '0xd0e30db0': 'deposit()',
    '0x2e1a7d4d': 'withdraw(uint256 amount)',
  };

  const selector = data.slice(0, 10).toLowerCase();
  const signature = SELECTORS[selector] || 'Unknown Function';
  const functionName = signature.split('(')[0];

  const riskFlags: string[] = [];
  if (selector === '0x095ea7b3') riskFlags.push('Token approval — grants spending permission');
  if (selector === '0xa22cb465') riskFlags.push('NFT approval for all tokens');
  if (selector === '0x23b872dd') riskFlags.push('Transfer tokens on your behalf');

  const riskLevel = riskFlags.length > 0 ? 'WARNING' : 'SAFE';

  return {
    functionName,
    humanReadable: signature,
    params: [],
    riskLevel,
    riskFlags,
    summary: riskFlags.length > 0
      ? `This transaction calls ${functionName} with ${riskFlags.length} risk flag(s).`
      : `This transaction calls ${functionName}. No major risks detected.`,
  };
}

// ─── Transaction Simulation ───────────────────────────────────────────────────

export interface TxSimulationResult {
  success: boolean;
  expectedOutcome: string;
  // UNKNOWN is the explicit fail-CLOSED value when GoPlus's simulation
  // endpoint is unreachable. Callers (SecurityGate) MUST treat UNKNOWN
  // as "do not green-light a sign" — the previous fallback fabricated
  // MEDIUM and let signs through during outages, violating CLAUDE.md
  // "no fabricated values".
  riskLevel: 'SAFE' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  estimatedGas: string;
  riskFlags: string[];
  balanceChanges: { token: string; change: string }[];
}

export async function simulateTransaction(
  fromAddress: string,
  toAddress: string,
  data: string,
  value: string,
  chain: string
): Promise<TxSimulationResult> {
  try {
    const chainId = resolveChainId(chain);
    const body = { chain_id: chainId, from_address: fromAddress, to_address: toAddress, input_data: data, value };
    const res = await fetch(`${GOPLUS_BASE}/transaction/simulation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error('Simulation API error');
    const result = await res.json();
    return parseTxSimulation(result.result ?? result);
  } catch {
    // CLAUDE.md "no fabricated values" — fail CLOSED. The prior code
    // returned `success:true riskLevel:MEDIUM` so SecurityGate green-
    // lighted signs even when no real check ran. UNKNOWN forces the
    // caller to either retry, surface "verify manually", or block.
    return {
      success: false, expectedOutcome: 'Simulation unavailable',
      riskLevel: 'UNKNOWN', estimatedGas: 'Unknown',
      riskFlags: ['Simulation unavailable — verify manually before signing'],
      balanceChanges: [],
    };
  }
}

function parseTxSimulation(d: any): TxSimulationResult {
  const riskFlags: string[] = [];
  if (d.is_dangerous === '1') riskFlags.push('Transaction marked as dangerous');
  if (d.is_phishing === '1') riskFlags.push('Phishing transaction detected');
  if (d.is_suspicious === '1') riskFlags.push('Suspicious transaction patterns');

  const balanceChanges = (d.balance_change || []).map((b: any) => ({
    token: b.symbol || b.token_address || 'Unknown',
    change: b.amount_change || '0',
  }));

  return {
    success: d.success !== false,
    expectedOutcome: d.description || (d.success !== false ? 'Transaction expected to succeed' : 'Transaction may fail'),
    riskLevel: riskFlags.length >= 2 ? 'HIGH' : riskFlags.length === 1 ? 'MEDIUM' : 'SAFE',
    estimatedGas: d.gas_used ? `${parseInt(d.gas_used).toLocaleString()} gas` : 'Unknown',
    riskFlags,
    balanceChanges,
  };
}

// ─── Dust Attack Detection ─────────────────────────────────────────────────────

export async function detectDustTokens(
  address: string,
  chain: string,
  tokens: string[]
): Promise<string[]> {
  try {
    const chainId = resolveChainId(chain);
    const dustTokens: string[] = [];
    const chunkSize = 10;
    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize).join(',');
      const data = await goplusGet(
        `/token_security/${chainId}?contract_addresses=${chunk}`
      );
      for (const [addr, t] of Object.entries(data as Record<string, any>)) {
        if (t.is_airdrop_scam === '1' || t.is_honeypot === '1') {
          dustTokens.push(addr);
        }
      }
    }
    return dustTokens;
  } catch {
    return [];
  }
}
