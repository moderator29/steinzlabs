/**
 * Security Intelligence Service
 * Internal security data provider — backend only, never expose provider name in UI
 */

const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1';
const API_KEY = '6qqc3yyg7Q7MA59r2QF0';

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

async function goplusGet(path: string): Promise<any> {
  const url = `${GOPLUS_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: API_KEY },
    next: { revalidate: 60 },
  });
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
  creatorAddress: string;
  ownerAddress: string;
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
  const chainId = resolveChainId(chain);
  const data = await goplusGet(
    `/token_security/${chainId}?contract_addresses=${contractAddress}`
  );
  const t = data[contractAddress.toLowerCase()] ?? Object.values(data)[0] ?? {};
  return parseTokenSecurity(t);
}

function parseTokenSecurity(t: any): TokenSecurityResult {
  const buyTax = parseFloat(t.buy_tax || '0');
  const sellTax = parseFloat(t.sell_tax || '0');
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
  score = Math.max(0, Math.min(100, score));

  let safetyLevel: TokenSecurityResult['safetyLevel'] = 'SAFE';
  let safetyColor = '#10B981';
  if (score < 30) { safetyLevel = 'DANGER'; safetyColor = '#EF4444'; }
  else if (score < 50) { safetyLevel = 'WARNING'; safetyColor = '#F59E0B'; }
  else if (score < 70) { safetyLevel = 'CAUTION'; safetyColor = '#F59E0B'; }

  const checks: { label: string; status: 'pass' | 'fail' | 'warn' }[] = [
    { label: 'Contract Verified', status: t.is_open_source === '1' ? 'pass' : 'fail' },
    { label: 'No Honeypot', status: t.is_honeypot === '1' ? 'fail' : 'pass' },
    { label: 'Ownership Renounced', status: t.owner_address === '' || t.owner_address === '0x0000000000000000000000000000000000000000' ? 'pass' : t.can_take_back_ownership === '1' ? 'fail' : 'warn' },
    { label: 'No Mint Function', status: t.is_mintable === '1' ? 'fail' : 'pass' },
    { label: 'No Proxy', status: t.is_proxy === '1' ? 'warn' : 'pass' },
    { label: 'No Hidden Owner', status: t.hidden_owner === '1' ? 'fail' : 'pass' },
    { label: 'No Self-Destruct', status: t.selfdestruct === '1' ? 'fail' : 'pass' },
    { label: 'Can Sell All', status: t.cannot_sell_all === '1' ? 'fail' : 'pass' },
    { label: 'Buy Tax Under 10%', status: buyTax > 0.1 ? 'fail' : buyTax > 0.05 ? 'warn' : 'pass' },
    { label: 'Sell Tax Under 10%', status: sellTax > 0.1 ? 'fail' : sellTax > 0.05 ? 'warn' : 'pass' },
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
  try {
    const encoded = encodeURIComponent(url);
    const data = await goplusGet(`/phishing_site?url=${encoded}`);
    return parseDomainScan(data, url);
  } catch {
    // Fallback heuristic scan
    return heuristicDomainScan(url);
  }
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

function heuristicDomainScan(url: string): DomainScanResult {
  const lower = url.toLowerCase();
  const signals: string[] = [];
  const PHISHING_PATTERNS = [
    'metamask', 'uniswap', 'coinbase', 'binance', 'phantom', 'ledger',
    'opensea', 'airdrop', 'freeclaim', 'verify-wallet', 'claim-nft',
    'connect-wallet', 'sync-wallet', 'recover-wallet',
  ];
  const SUSPICIOUS_TLDS = ['.xyz', '.click', '.link', '.info', '.cc', '.tk', '.ml'];

  let phishingScore = 0;
  for (const pattern of PHISHING_PATTERNS) {
    if (lower.includes(pattern)) {
      signals.push(`Keyword match: "${pattern}"`);
      phishingScore += 30;
    }
  }
  for (const tld of SUSPICIOUS_TLDS) {
    if (lower.includes(tld)) {
      signals.push(`Suspicious domain extension: ${tld}`);
      phishingScore += 15;
    }
  }
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(lower)) {
    signals.push('Direct IP address used (no domain)');
    phishingScore += 20;
  }
  if (lower.includes('-') && (lower.includes('wallet') || lower.includes('secure'))) {
    signals.push('Suspicious hyphenated domain pattern');
    phishingScore += 10;
  }

  phishingScore = Math.min(100, phishingScore);
  let verdict: DomainScanResult['verdict'] = 'SAFE';
  if (phishingScore >= 60) verdict = 'PHISHING';
  else if (phishingScore >= 25) verdict = 'SUSPICIOUS';

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
  riskLevel: 'SAFE' | 'MEDIUM' | 'HIGH';
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
    });
    if (!res.ok) throw new Error('Simulation API error');
    const result = await res.json();
    return parseTxSimulation(result.result ?? result);
  } catch {
    return {
      success: true, expectedOutcome: 'Transaction would likely execute',
      riskLevel: 'MEDIUM', estimatedGas: 'Unknown',
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
