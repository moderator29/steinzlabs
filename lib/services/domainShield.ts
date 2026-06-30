import 'server-only';
import { cache, cacheKey, TTL } from '../api/cache-manager';
import { cacheGet, cacheSet } from '../cache/redis';
import { scanDomain, type DomainScanResult } from '../security/goplusService';
import { vtxAnalyze } from './anthropic';

/**
 * Domain Shield — multi-source phishing / domain-safety verdict.
 *
 * Every signal in the output traces to a real source. No verdict number is
 * fabricated: the score is computed in code from the booleans/integers the
 * sources actually return, and when no source responds we surface an honest
 * UNKNOWN state rather than inventing a confidence figure.
 *
 * Sources (all free / already integrated):
 *   - GoPlus phishing_site            → known phishing / malicious flag
 *   - MetaMask eth-phishing-detect    → community blocklist / allowlist (JSON)
 *   - RDAP (rdap.org)                 → registration date → domain age
 *   - Google Safe Browsing            → ONLY if GOOGLE_SAFE_BROWSING_KEY is set
 *
 * The Anthropic summary (optional) receives ONLY the real signals and is
 * instructed to produce qualitative prose with no numbers of its own.
 */

export type DomainVerdict = 'SAFE' | 'SUSPICIOUS' | 'PHISHING' | 'UNKNOWN';

export interface DomainSource {
  /** Stable id for the source. */
  id: 'goplus' | 'metamask' | 'rdap' | 'safebrowsing';
  /** Human label shown in the UI. */
  label: string;
  /** Whether the source returned usable data this scan. */
  available: boolean;
  /** Source-level verdict contribution, or 'unknown' when it had no data. */
  status: 'clean' | 'flagged' | 'allowlisted' | 'info' | 'unknown';
  /** One short human-readable line describing what the source found. */
  detail: string;
}

export interface DomainShieldResult {
  url: string;
  host: string;
  verdict: DomainVerdict;
  /**
   * Transparent score 0..100 computed from real signals (higher = safer),
   * or null when no source returned data. NEVER fabricated.
   */
  safetyScore: number | null;
  signals: string[];
  sources: DomainSource[];
  /** Real registration date (ISO) when RDAP returns it, else null. */
  registeredAt: string | null;
  /** Whole days since registration when known, else null. */
  domainAgeDays: number | null;
  /** Grounded qualitative summary from Anthropic (no numbers), or null. */
  aiSummary: string | null;
  scannedAt: string;
}

const METAMASK_BLOCKLIST_URL =
  'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json';
const RDAP_BASE = 'https://rdap.org/domain/';
const SAFE_BROWSING_URL =
  'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const FETCH_TIMEOUT_MS = 8000;

// ─── Host extraction ──────────────────────────────────────────────────────────

function extractHost(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    // Hostnames are ASCII/DNS — case-insensitive by spec. This is NOT a wallet
    // or token address, so lower-casing here is correct and safe.
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Strip a leading "www." so blocklist/allowlist matching is consistent. */
function baseHost(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host;
}

// ─── MetaMask eth-phishing-detect blocklist ───────────────────────────────────

interface MetaMaskConfig {
  blacklist: string[];
  whitelist: string[];
  fuzzylist: string[];
}

const METAMASK_CACHE_KEY = cacheKey('metamask', 'eth_phishing_detect', {});
// The list is large and changes slowly; cache it for an hour in-memory and in
// Redis so we never refetch it per domain scan.
const METAMASK_TTL_MS = 60 * 60_000;
const METAMASK_TTL_S = 60 * 60;

async function getMetaMaskConfig(): Promise<MetaMaskConfig | null> {
  const mem = cache.get<MetaMaskConfig>(METAMASK_CACHE_KEY);
  if (mem) return mem;

  const redisHit = await cacheGet<MetaMaskConfig>(METAMASK_CACHE_KEY);
  if (redisHit) {
    cache.set(METAMASK_CACHE_KEY, redisHit, METAMASK_TTL_MS);
    return redisHit;
  }

  try {
    const res = await fetch(METAMASK_BLOCKLIST_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: METAMASK_TTL_S },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as Partial<MetaMaskConfig>;
    const config: MetaMaskConfig = {
      blacklist: Array.isArray(raw.blacklist) ? raw.blacklist : [],
      whitelist: Array.isArray(raw.whitelist) ? raw.whitelist : [],
      fuzzylist: Array.isArray(raw.fuzzylist) ? raw.fuzzylist : [],
    };
    cache.set(METAMASK_CACHE_KEY, config, METAMASK_TTL_MS);
    void cacheSet(METAMASK_CACHE_KEY, config, METAMASK_TTL_S);
    return config;
  } catch {
    return null;
  }
}

/** Match host (or any parent domain) against an eth-phishing-detect list. */
function listMatches(host: string, list: string[]): boolean {
  const target = baseHost(host);
  for (const entry of list) {
    const e = entry.toLowerCase();
    if (target === e || target.endsWith(`.${e}`)) return true;
  }
  return false;
}

async function checkMetaMask(host: string): Promise<DomainSource> {
  const config = await getMetaMaskConfig();
  if (!config) {
    return {
      id: 'metamask',
      label: 'Community blocklist',
      available: false,
      status: 'unknown',
      detail: 'Blocklist unavailable',
    };
  }
  if (listMatches(host, config.blacklist)) {
    return {
      id: 'metamask',
      label: 'Community blocklist',
      available: true,
      status: 'flagged',
      detail: 'Listed on the community phishing blocklist',
    };
  }
  if (listMatches(host, config.whitelist)) {
    return {
      id: 'metamask',
      label: 'Community blocklist',
      available: true,
      status: 'allowlisted',
      detail: 'On the community allowlist of known legitimate sites',
    };
  }
  return {
    id: 'metamask',
    label: 'Community blocklist',
    available: true,
    status: 'clean',
    detail: 'Not present on the community phishing blocklist',
  };
}

// ─── RDAP domain age ──────────────────────────────────────────────────────────

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapResponse {
  events?: RdapEvent[];
}

/** Reduce a host to its registrable domain (last two labels) for RDAP. */
function registrableDomain(host: string): string {
  const parts = baseHost(host).split('.');
  if (parts.length <= 2) return parts.join('.');
  return parts.slice(-2).join('.');
}

interface RdapResult {
  source: DomainSource;
  registeredAt: string | null;
  ageDays: number | null;
}

async function checkRdap(host: string): Promise<RdapResult> {
  const domain = registrableDomain(host);
  try {
    const res = await fetch(`${RDAP_BASE}${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/rdap+json' },
      next: { revalidate: 6 * 60 * 60 },
    });
    if (!res.ok) {
      return {
        source: {
          id: 'rdap',
          label: 'Domain age (RDAP)',
          available: false,
          status: 'unknown',
          detail: 'Registration data unavailable',
        },
        registeredAt: null,
        ageDays: null,
      };
    }
    const data = (await res.json()) as RdapResponse;
    const registration = (data.events ?? []).find(
      (e) => e.eventAction === 'registration' && e.eventDate
    );
    if (!registration?.eventDate) {
      return {
        source: {
          id: 'rdap',
          label: 'Domain age (RDAP)',
          available: false,
          status: 'unknown',
          detail: 'Registration date not published',
        },
        registeredAt: null,
        ageDays: null,
      };
    }
    const registeredAt = new Date(registration.eventDate);
    if (Number.isNaN(registeredAt.getTime())) {
      return {
        source: {
          id: 'rdap',
          label: 'Domain age (RDAP)',
          available: false,
          status: 'unknown',
          detail: 'Registration date not published',
        },
        registeredAt: null,
        ageDays: null,
      };
    }
    const ageDays = Math.max(
      0,
      Math.floor((Date.now() - registeredAt.getTime()) / 86_400_000)
    );
    const detail =
      ageDays < 30
        ? `Registered ${ageDays} days ago (very new domain)`
        : ageDays < 365
          ? `Registered ${ageDays} days ago`
          : `Registered over ${Math.floor(ageDays / 365)} year(s) ago`;
    return {
      source: {
        id: 'rdap',
        label: 'Domain age (RDAP)',
        available: true,
        status: ageDays < 30 ? 'flagged' : 'info',
        detail,
      },
      registeredAt: registeredAt.toISOString(),
      ageDays,
    };
  } catch {
    return {
      source: {
        id: 'rdap',
        label: 'Domain age (RDAP)',
        available: false,
        status: 'unknown',
        detail: 'Registration data unavailable',
      },
      registeredAt: null,
      ageDays: null,
    };
  }
}

// ─── GoPlus phishing_site ─────────────────────────────────────────────────────

async function checkGoPlus(url: string): Promise<{
  source: DomainSource;
  raw: DomainScanResult | null;
}> {
  try {
    const raw = await scanDomain(url);
    if (raw.isPhishing || raw.isMalicious) {
      return {
        source: {
          id: 'goplus',
          label: 'Phishing intelligence',
          available: true,
          status: 'flagged',
          detail: raw.isPhishing
            ? 'Flagged as a known phishing site'
            : 'Flagged for malicious activity',
        },
        raw,
      };
    }
    return {
      source: {
        id: 'goplus',
        label: 'Phishing intelligence',
        available: true,
        status: 'clean',
        detail: 'No phishing or malicious flags returned',
      },
      raw,
    };
  } catch {
    return {
      source: {
        id: 'goplus',
        label: 'Phishing intelligence',
        available: false,
        status: 'unknown',
        detail: 'Phishing intelligence unavailable',
      },
      raw: null,
    };
  }
}

// ─── Google Safe Browsing (gated on env) ──────────────────────────────────────

async function checkSafeBrowsing(url: string): Promise<DomainSource | null> {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return null; // Source not configured — omit entirely, never fake it.
  try {
    const res = await fetch(`${SAFE_BROWSING_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        client: { clientId: 'naka-labs', clientVersion: '1.0.0' },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION',
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!res.ok) {
      return {
        id: 'safebrowsing',
        label: 'Google Safe Browsing',
        available: false,
        status: 'unknown',
        detail: 'Safe Browsing lookup unavailable',
      };
    }
    const data = (await res.json()) as { matches?: Array<{ threatType?: string }> };
    const matches = data.matches ?? [];
    if (matches.length > 0) {
      const types = matches
        .map((m) => m.threatType)
        .filter(Boolean)
        .join(', ');
      return {
        id: 'safebrowsing',
        label: 'Google Safe Browsing',
        available: true,
        status: 'flagged',
        detail: types ? `Flagged: ${types}` : 'Flagged by Safe Browsing',
      };
    }
    return {
      id: 'safebrowsing',
      label: 'Google Safe Browsing',
      available: true,
      status: 'clean',
      detail: 'No Safe Browsing threats matched',
    };
  } catch {
    return {
      id: 'safebrowsing',
      label: 'Google Safe Browsing',
      available: false,
      status: 'unknown',
      detail: 'Safe Browsing lookup unavailable',
    };
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Combine real source signals into a transparent verdict + score.
 *
 * Score starts at a neutral 100 (safe) and is reduced by penalties tied to
 * concrete signals. It is only meaningful when at least one source returned
 * data; otherwise we return UNKNOWN with a null score (no fabrication).
 */
function combine(
  url: string,
  host: string,
  goplus: DomainSource,
  metamask: DomainSource,
  rdap: RdapResult,
  safeBrowsing: DomainSource | null
): Pick<DomainShieldResult, 'verdict' | 'safetyScore' | 'signals' | 'sources'> {
  const sources: DomainSource[] = [goplus, metamask, rdap.source];
  if (safeBrowsing) sources.push(safeBrowsing);

  const anyData = sources.some((s) => s.available);
  if (!anyData) {
    return { verdict: 'UNKNOWN', safetyScore: null, signals: [], sources };
  }

  const signals: string[] = [];
  let score = 100;
  let hardFlag = false;

  // Confirmed-threat sources (GoPlus / Safe Browsing / MetaMask blocklist) are
  // authoritative: any one flag forces a PHISHING verdict.
  if (goplus.status === 'flagged') {
    signals.push(goplus.detail);
    hardFlag = true;
    score -= 70;
  }
  if (safeBrowsing?.status === 'flagged') {
    signals.push(`Google Safe Browsing: ${safeBrowsing.detail}`);
    hardFlag = true;
    score -= 70;
  }
  if (metamask.status === 'flagged') {
    signals.push(metamask.detail);
    hardFlag = true;
    score -= 70;
  }

  // Domain age is a soft signal: very new domains carry elevated risk. An
  // allowlist hit suppresses the soft age penalty (an established, vetted brand
  // can legitimately register fresh domains).
  const allowlisted = metamask.status === 'allowlisted';
  if (rdap.ageDays !== null && !allowlisted) {
    if (rdap.ageDays < 30) {
      signals.push(rdap.source.detail);
      score -= 25;
    } else if (rdap.ageDays < 90) {
      signals.push(`${rdap.source.detail} (relatively recent)`);
      score -= 10;
    }
  }

  score = Math.max(0, Math.min(100, score));

  let verdict: DomainVerdict;
  if (hardFlag) {
    verdict = 'PHISHING';
  } else if (score >= 70) {
    verdict = 'SAFE';
  } else {
    verdict = 'SUSPICIOUS';
  }

  return { verdict, safetyScore: score, signals, sources };
}

// ─── Grounded AI summary (qualitative, no numbers) ────────────────────────────

async function buildAiSummary(
  host: string,
  verdict: DomainVerdict,
  sources: DomainSource[],
  signals: string[],
  ageDays: number | null
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const sourceLines = sources
      .map(
        (s) =>
          `- ${s.label}: ${s.available ? s.status : 'no data'}${s.available ? ` (${s.detail})` : ''}`
      )
      .join('\n');
    const prompt = `You are writing a short safety note for a crypto user who is about to visit a website. Use ONLY the real signals below. Do NOT invent or state any numbers, percentages, scores, or confidence values. Do NOT mention any data source by brand name. Write 2 to 3 plain sentences of qualitative guidance grounded strictly in these signals. If signals are limited, say so honestly.

Domain: ${host}
Combined verdict: ${verdict}
Domain age in days (if known): ${ageDays ?? 'unknown'}

Signal sources:
${sourceLines}

Specific findings:
${signals.length > 0 ? signals.map((s) => `- ${s}`).join('\n') : '- No specific risk findings reported.'}`;

    const text = await vtxAnalyze(prompt, 350);
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function analyzeDomain(url: string): Promise<DomainShieldResult> {
  const scannedAt = new Date().toISOString();
  const host = extractHost(url);

  if (!host) {
    return {
      url,
      host: '',
      verdict: 'UNKNOWN',
      safetyScore: null,
      signals: ['URL could not be parsed'],
      sources: [],
      registeredAt: null,
      domainAgeDays: null,
      aiSummary: null,
      scannedAt,
    };
  }

  const key = cacheKey('domain_shield', 'analyze', { url });
  const cached = cache.get<DomainShieldResult>(key);
  if (cached) return cached;

  const [goplus, metamask, rdap, safeBrowsing] = await Promise.all([
    checkGoPlus(url),
    checkMetaMask(host),
    checkRdap(host),
    checkSafeBrowsing(url),
  ]);

  const combined = combine(url, host, goplus.source, metamask, rdap, safeBrowsing);

  const aiSummary = await buildAiSummary(
    host,
    combined.verdict,
    combined.sources,
    combined.signals,
    rdap.ageDays
  );

  const result: DomainShieldResult = {
    url,
    host,
    verdict: combined.verdict,
    safetyScore: combined.safetyScore,
    signals: combined.signals,
    sources: combined.sources,
    registeredAt: rdap.registeredAt,
    domainAgeDays: rdap.ageDays,
    aiSummary,
    scannedAt,
  };

  cache.set(key, result, TTL.TOKEN_SECURITY);
  return result;
}
