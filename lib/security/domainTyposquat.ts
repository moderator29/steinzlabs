/**
 * Domain typosquat / homograph / punycode lookalike detector.
 *
 * PURE module: no network, no env, no side effects. Deterministic given its
 * inputs, so every signal it emits traces directly to the domain string
 * itself rather than to a fabricated confidence number.
 *
 * Blocklists (GoPlus, MetaMask eth-phishing-detect) are reactive and lag fresh
 * registrations. A brand-new uniswapp.org / metmask.io / punycode xn-- lookalike
 * passes those lists as UNKNOWN/SAFE for hours or days. This module closes that
 * window proactively by inspecting the string for three attack shapes:
 *
 *   1. Homograph / IDN     xn-- labels and mixed-script (Cyrillic / Greek /
 *                          Armenian ...) glyphs that render like ASCII brands,
 *                          e.g. "аррӏе.com" where the letters are Cyrillic.
 *   2. Typosquat           Damerau/Levenshtein distance 1 or 2 to a known dApp
 *                          brand while NOT being that brand, e.g. uniswapp.org.
 *   3. Wrong-TLD spoof     the exact brand label on a different public suffix
 *                          than the brand's canonical one, e.g. uniswap.example
 *                          when the real site lives on another TLD.
 *
 * Note: this operates on DOMAINS (DNS names), which are case-insensitive by
 * spec, so lower-casing here is correct. It is NEVER applied to wallet/token
 * addresses.
 */

import punycode from 'node:punycode';

// ─── Public-suffix handling ───────────────────────────────────────────────────

/**
 * Curated set of common multi-label public suffixes. registrableDomain() needs
 * these so `foo.co.uk` resolves to `foo.co.uk` (not `co.uk`) and its brand
 * label is `foo`, not `co`. This is intentionally a small hardcoded set rather
 * than the full Public Suffix List; it covers the suffixes that actually show
 * up for dApp phishing.
 */
const MULTI_PART_SUFFIXES: ReadonlySet<string> = new Set([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'gov.au', 'edu.au', 'id.au',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'co.jp', 'ne.jp', 'or.jp', 'go.jp', 'ac.jp',
  'co.kr', 'or.kr',
  'co.in', 'net.in', 'org.in', 'gov.in',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  'co.za', 'org.za', 'gov.za',
  'com.mx', 'com.tr', 'com.sg', 'com.hk', 'com.tw', 'com.ua', 'com.ru',
  'co.nz', 'org.nz', 'com.co', 'com.ar', 'com.ve',
]);

/** Strip a leading "www." for consistent matching. */
function stripWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host;
}

/**
 * Reduce a hostname to its registrable domain (brand label + public suffix),
 * honouring multi-label suffixes like .co.uk / .com.br. Fixes the previous
 * naive slice(-2) which mangled those into `co.uk` etc.
 */
export function registrableDomain(host: string): string {
  const parts = stripWww(host.toLowerCase()).split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/** Split a registrable domain into its brand label (SLD) and public suffix. */
function splitRegistrable(registrable: string): { sld: string; suffix: string } {
  const parts = registrable.split('.').filter(Boolean);
  if (parts.length <= 1) return { sld: registrable, suffix: '' };
  const lastTwo = parts.slice(-2).join('.');
  if (parts.length >= 3 && MULTI_PART_SUFFIXES.has(lastTwo)) {
    return { sld: parts.slice(0, -2).join('.'), suffix: lastTwo };
  }
  return { sld: parts.slice(0, -1).join('.'), suffix: parts[parts.length - 1] };
}

// ─── Known dApp brand allowlist ───────────────────────────────────────────────

/**
 * Curated registrable domains of the brands phishing kits most commonly
 * impersonate. Seeded from goplusService CANONICAL_DOMAINS and extended with
 * the major wallets / DEXs / CEXs / NFT markets. MetaMask's live `fuzzylist`
 * is layered on top at call time (see analyzeTyposquat's extraBrands arg), so
 * this static seed does not need to be exhaustive.
 */
export const KNOWN_DAPP_DOMAINS: readonly string[] = [
  // Wallets
  'metamask.io', 'phantom.app', 'rainbow.me', 'trustwallet.com', 'ledger.com',
  'trezor.io', 'coinbase.com', 'safe.global', 'rabby.io', 'exodus.com', 'zerion.io',
  'backpack.app', 'solflare.com',
  // DEX / DeFi
  'uniswap.org', 'pancakeswap.finance', 'aave.com', 'curve.fi', 'lido.fi',
  'raydium.io', 'jup.ag', '1inch.io', 'sushi.com', 'compound.finance', 'makerdao.com',
  'balancer.fi', 'dydx.exchange', 'gmx.io', 'pendle.finance', 'ethena.fi',
  'jito.network', 'marinade.finance', 'orca.so', 'drift.trade', 'hyperliquid.xyz',
  // CEX
  'binance.com', 'kraken.com', 'okx.com', 'bybit.com', 'kucoin.com', 'bitget.com',
  // NFT
  'opensea.io', 'blur.io', 'magiceden.io', 'tensor.trade',
  // Infra / explorers
  'etherscan.io', 'solscan.io', 'chain.link', 'ens.domains', 'arbitrum.io',
  'optimism.io', 'polygon.technology', 'base.org',
];

interface Brand {
  registrable: string;
  sld: string;
  suffix: string;
}

function buildBrands(extra: readonly string[]): Brand[] {
  const seen = new Set<string>();
  const brands: Brand[] = [];
  for (const raw of [...KNOWN_DAPP_DOMAINS, ...extra]) {
    if (typeof raw !== 'string') continue;
    const registrable = registrableDomain(raw.trim().toLowerCase());
    if (!registrable || seen.has(registrable)) continue;
    seen.add(registrable);
    const { sld, suffix } = splitRegistrable(registrable);
    if (!sld) continue;
    brands.push({ registrable, sld, suffix });
  }
  return brands;
}

// ─── Homoglyph / script analysis ──────────────────────────────────────────────

/**
 * Common cross-script confusables that render like ASCII letters. Collapsing a
 * label through this map produces a "skeleton" that can be compared against
 * ASCII brand labels to catch homograph attacks. Deliberately excludes ASCII
 * digit confusables (0/1) since digits are legitimate in real domains.
 */
const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i',
  'ѕ': 's', 'ԁ': 'd', 'ո': 'n', 'м': 'm', 'т': 't', 'к': 'k', 'ь': 'b', 'н': 'h',
  'в': 'b', 'г': 'r', 'ј': 'j', 'ӏ': 'l', 'қ': 'k', 'ԛ': 'q', 'ѡ': 'w', 'һ': 'h',
  // Greek
  'α': 'a', 'ο': 'o', 'ρ': 'p', 'ε': 'e', 'ι': 'i', 'ν': 'v', 'τ': 't', 'κ': 'k',
  'υ': 'u', 'χ': 'x', 'ϲ': 'c', 'ζ': 'z', 'η': 'n', 'β': 'b',
  // Armenian
  'օ': 'o', 'ց': 'g', 'ս': 'u',
};

function toSkeleton(label: string): string {
  let out = '';
  for (const ch of label.toLowerCase()) {
    out += CONFUSABLES[ch] ?? ch;
  }
  return out;
}

function detectScripts(label: string): string[] {
  const scripts = new Set<string>();
  for (const ch of label) {
    const cp = ch.codePointAt(0) ?? 0;
    if (/[a-z0-9]/i.test(ch)) { scripts.add('latin'); continue; }
    if (cp === 0x2d || cp === 0x2e || cp === 0x5f) continue; // hyphen, dot, underscore
    if (cp <= 0x7f) continue; // other ASCII punctuation
    if (cp >= 0x0400 && cp <= 0x04ff) scripts.add('cyrillic');
    else if (cp >= 0x0370 && cp <= 0x03ff) scripts.add('greek');
    else if (cp >= 0x0530 && cp <= 0x058f) scripts.add('armenian');
    else if (cp >= 0x0590 && cp <= 0x05ff) scripts.add('hebrew');
    else if (cp >= 0x0600 && cp <= 0x06ff) scripts.add('arabic');
    else if (cp >= 0x4e00 && cp <= 0x9fff) scripts.add('han');
    else scripts.add('other');
  }
  return [...scripts];
}

// ─── Damerau/Levenshtein (optimal string alignment) ───────────────────────────

/** Edit distance allowing insertion, deletion, substitution, and transposition. */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const d: number[][] = Array.from({ length: al + 1 }, () => new Array<number>(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[al][bl];
}

// ─── Public result shape ──────────────────────────────────────────────────────

export type TyposquatSeverity = 'none' | 'low' | 'high';

export interface TyposquatResult {
  host: string;
  registrable: string;
  sld: string;
  /** True when any label is punycode (xn--). */
  hasPunycode: boolean;
  /** Unicode rendering of a punycode host, when decodable. */
  decodedUnicode: string | null;
  /** Scripts present in the (decoded) brand label. */
  scripts: string[];
  /** True when Latin is mixed with another script (classic homograph shape). */
  mixedScript: boolean;
  /** True when the domain is exactly an allowlisted brand. */
  isExactBrand: boolean;
  /** Closest brand this domain resembles, when a lookalike was found. */
  nearestBrand: string | null;
  /** Edit distance to nearestBrand (skeleton compared), when applicable. */
  editDistance: number | null;
  /** 'high' = act-now lookalike; 'low' = soft warning; 'none' = no pattern. */
  severity: TyposquatSeverity;
  /** One human-readable summary line (no fabricated numbers). */
  detail: string;
  /** All findings, for transparent display. */
  signals: string[];
}

function benign(base: Omit<TyposquatResult, 'severity' | 'detail' | 'signals' | 'nearestBrand' | 'editDistance' | 'isExactBrand'>, exact: boolean): TyposquatResult {
  return {
    ...base,
    isExactBrand: exact,
    nearestBrand: null,
    editDistance: null,
    severity: 'none',
    detail: exact
      ? 'Exact match to a known dApp domain'
      : 'No typosquat or homograph pattern detected',
    signals: [],
  };
}

/**
 * Analyse a hostname for lookalike / typosquat / homograph patterns.
 *
 * @param host        Hostname (may be punycode / IDN, may include subdomains).
 * @param extraBrands Additional brand domains to compare against (e.g. the live
 *                    MetaMask fuzzylist). Merged with the curated seed list.
 */
export function analyzeTyposquat(host: string, extraBrands: readonly string[] = []): TyposquatResult {
  const asciiHost = stripWww(host.toLowerCase());
  const hasPunycode = asciiHost.split('.').some((l) => l.startsWith('xn--'));

  let decodedUnicode: string | null = null;
  if (hasPunycode) {
    try {
      const decoded = punycode.toUnicode(asciiHost);
      decodedUnicode = decoded !== asciiHost ? decoded : null;
    } catch {
      decodedUnicode = null;
    }
  }

  const registrable = registrableDomain(asciiHost);
  const { sld, suffix } = splitRegistrable(registrable);

  // Label used for homoglyph analysis: the decoded (unicode) brand label when
  // the host is punycode, else the raw label (which may already contain unicode
  // if a caller passed a non-ASCII host directly).
  const displayHost = decodedUnicode ?? asciiHost;
  const displaySld = splitRegistrable(registrableDomain(displayHost)).sld;
  const scripts = detectScripts(displaySld);
  const hasNonLatin = scripts.some((s) => s !== 'latin');
  const mixedScript = scripts.includes('latin') && hasNonLatin;
  const skel = toSkeleton(displaySld);

  const base = {
    host: asciiHost,
    registrable,
    sld,
    hasPunycode,
    decodedUnicode,
    scripts,
    mixedScript,
  };

  const brands = buildBrands(extraBrands);

  // Exact allowlisted brand — benign, short-circuit.
  if (brands.some((b) => b.registrable === registrable) && !hasNonLatin) {
    return benign(base, true);
  }

  // 1. Homoglyph impersonation: the skeleton collapses onto (or lands within
  //    edit distance 1 of) a real brand label, and the domain used non-ASCII or
  //    punycode to get there.
  if (hasNonLatin || hasPunycode) {
    let homograph: Brand | null = brands.find((b) => b.sld.length >= 3 && b.sld === skel) ?? null;
    if (!homograph) {
      for (const b of brands) {
        if (b.sld.length < 4) continue;
        if (Math.abs(b.sld.length - skel.length) > 1) continue;
        if (damerauLevenshtein(skel, b.sld) <= 1) { homograph = b; break; }
      }
    }
    if (homograph) {
      const detail = `Homoglyph lookalike of ${homograph.registrable} built from non-standard characters`;
      const signals = [detail];
      if (decodedUnicode) signals.push(`Renders as "${decodedUnicode}"`);
      if (mixedScript) signals.push(`Mixes Latin with ${scripts.filter((s) => s !== 'latin').join(', ')} characters`);
      return {
        ...base,
        isExactBrand: false,
        nearestBrand: homograph.registrable,
        editDistance: skel === homograph.sld ? 0 : 1,
        severity: 'high',
        detail,
        signals,
      };
    }
  }

  // 2. Typosquat by edit distance on the ASCII/skeleton brand label.
  let nearest: Brand | null = null;
  let nearestDist = Infinity;
  for (const b of brands) {
    if (b.sld.length < 4) continue;              // short labels are too FP-prone for fuzzy match
    if (skel === b.sld) continue;                // handled by exact / wrong-TLD paths
    if (Math.abs(b.sld.length - skel.length) > 2) continue;
    const dist = damerauLevenshtein(skel, b.sld);
    const shortSide = Math.min(b.sld.length, skel.length);
    const maxDist = shortSide <= 4 ? 1 : 2;
    if (dist >= 1 && dist <= maxDist && dist < nearestDist) {
      nearest = b;
      nearestDist = dist;
    }
  }
  if (nearest) {
    const severity: TyposquatSeverity = nearestDist === 1 ? 'high' : 'low';
    const detail =
      severity === 'high'
        ? `Very close typo of ${nearest.registrable} (one character different)`
        : `Resembles ${nearest.registrable} (two characters different)`;
    return {
      ...base,
      isExactBrand: false,
      nearestBrand: nearest.registrable,
      editDistance: nearestDist,
      severity,
      detail,
      signals: [detail],
    };
  }

  // 3. Wrong-TLD spoof: exact brand label, different public suffix.
  const wrongTld = brands.find((b) => b.sld.length >= 3 && b.sld === skel && b.suffix !== suffix);
  if (wrongTld) {
    const detail = `Uses the ${wrongTld.sld} brand name on a different top-level domain than the official ${wrongTld.registrable}`;
    return {
      ...base,
      isExactBrand: false,
      nearestBrand: wrongTld.registrable,
      editDistance: 0,
      severity: 'low',
      detail,
      signals: [detail],
    };
  }

  // 4. Internationalized domain that does not resemble a known brand: still a
  //    soft "verify this" signal, since dApps rarely use punycode/IDN.
  if (hasPunycode || hasNonLatin) {
    const detail = 'Internationalized (punycode) domain: confirm it is the site you intend to visit';
    const signals = [detail];
    if (decodedUnicode) signals.push(`Renders as "${decodedUnicode}"`);
    return {
      ...base,
      isExactBrand: false,
      nearestBrand: null,
      editDistance: null,
      severity: 'low',
      detail,
      signals,
    };
  }

  return benign(base, false);
}
