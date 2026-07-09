import 'server-only';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * News API — FREE multi-source crypto news aggregator.
 *
 * CryptoPanic went paid, so this route stitches together only keyless / free
 * sources, fetched in parallel with a per-source timeout + try/catch:
 *
 *   RSS (keyless):
 *     - CoinTelegraph   https://cointelegraph.com/rss
 *     - WatcherGuru     https://watcherguru.com/feed   (fallback /rss)
 *     - Decrypt         https://decrypt.co/feed
 *     - The Block       https://www.theblock.co/rss.xml
 *     - Bankless        https://www.bankless.com/rss
 *     - CoinDesk        https://www.coindesk.com/arc/outboundfeeds/rss/
 *   JSON (keyless):
 *     - CryptoCompare   https://min-api.cryptocompare.com/data/v2/news/?lang=EN
 *   JSON (optional key):
 *     - CoinGecko news  (only attempted when COINGECKO_API_KEY is present)
 *
 * Every item is normalised to a common shape, deduped across sources
 * (title similarity + url host/path), sorted newest-first, capped, and cached
 * in-memory ~120s. A dead source is logged and skipped. If ALL sources fail we
 * serve stale cache when we have it, else an honest 502 + empty list — never
 * fabricated items and never "Invalid Date".
 */

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO 8601, or '' if unparseable
  summary: string;
  imageUrl: string | null;
  tags: string[];
}

const CACHE_TTL = 120_000; // 120s
const MAX_ITEMS = 40;
const PER_SOURCE_TIMEOUT = 7_000; // 7s per source
const SUMMARY_MAX = 240;

const UA = 'SteinzLabs-News/1.0 (+https://steinzlabs.com)';

let cache: { data: NewsItem[]; ts: number } | null = null;

// ── RSS source registry ─────────────────────────────────────────────────────
// `urls` is tried in order until one yields items (covers feeds whose path we
// are not 100% sure of, e.g. WatcherGuru /feed vs /rss).
interface RssSource {
  source: string;
  urls: string[];
}

const RSS_SOURCES: RssSource[] = [
  { source: 'CoinTelegraph', urls: ['https://cointelegraph.com/rss'] },
  { source: 'WatcherGuru', urls: ['https://watcherguru.com/feed', 'https://watcherguru.com/rss'] },
  { source: 'Decrypt', urls: ['https://decrypt.co/feed'] },
  { source: 'The Block', urls: ['https://www.theblock.co/rss.xml'] },
  { source: 'Bankless', urls: ['https://www.bankless.com/rss'] },
  { source: 'CoinDesk', urls: ['https://www.coindesk.com/arc/outboundfeeds/rss/'] },
];

// ── HTML helpers ────────────────────────────────────────────────────────────
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeFromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeFromCharCode(parseInt(d, 10)))
    .replace(/&[a-zA-Z]+;/g, (m) => ENTITIES[m] ?? m);
}

function safeFromCharCode(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

function stripHtml(input: string): string {
  if (!input) return '';
  return decodeEntities(
    input
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<\/(p|div|br|li|h\d)>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCdata(input: string): string {
  const m = input.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (m ? m[1] : input).trim();
}

// Pull the inner text of the first matching <tag>…</tag> within a block.
function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

// Pull an attribute value from the first tag of `name`.
function attr(block: string, name: string, attribute: string): string | null {
  const re = new RegExp(`<${name}\\b[^>]*?\\b${attribute}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i');
  const m = block.match(re);
  return m ? m[1] : null;
}

function extractImage(block: string): string | null {
  // Common RSS image carriers, most specific first.
  const media =
    attr(block, 'media:content', 'url') ||
    attr(block, 'media:thumbnail', 'url');
  if (media) return decodeEntities(media);

  const encUrl = attr(block, 'enclosure', 'url');
  const encType = attr(block, 'enclosure', 'type');
  if (encUrl && (!encType || encType.startsWith('image'))) return decodeEntities(encUrl);

  const desc = tag(block, 'content:encoded') || tag(block, 'description');
  const imgMatch = desc.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  if (imgMatch) return decodeEntities(imgMatch[1]);

  return null;
}

function extractTags(block: string): string[] {
  const out: string[] = [];
  const re = /<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const t = stripHtml(stripCdata(m[1]));
    if (t) out.push(t);
  }
  return Array.from(new Set(out)).slice(0, 4);
}

function toIso(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  // Numeric unix seconds (CryptoCompare) or ms.
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  const s = String(raw).trim();
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function clampSummary(s: string): string {
  const clean = (s || '').trim();
  if (clean.length <= SUMMARY_MAX) return clean;
  return `${clean.slice(0, SUMMARY_MAX - 1).trimEnd()}…`;
}

// Stable, dependency-free hash for ids.
function hash(basis: string): string {
  let h = 0;
  for (let i = 0; i < basis.length; i++) {
    h = (h << 5) - h + basis.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function makeId(prefix: string, basis: string): string {
  return `${prefix}_${hash(basis)}`;
}

// ── per-source fetch with timeout ────────────────────────────────────────────
async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_SOURCE_TIMEOUT);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': UA, Accept: accept },
      signal: controller.signal,
      // Route owns its own in-memory cache; keep fetch itself fresh-ish.
      next: { revalidate: 120 },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── RSS parsing ──────────────────────────────────────────────────────────────
function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  // Support both RSS <item> and Atom <entry>.
  const isAtom = /<entry\b/i.test(xml) && !/<item\b/i.test(xml);
  const re = isAtom
    ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
    : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(xml)) !== null && items.length < 60) {
    const block = m[1];

    const title = stripHtml(stripCdata(tag(block, 'title')));

    let link = decodeEntities(stripCdata(tag(block, 'link'))).trim();
    if (isAtom || !link) {
      // Atom links live in an attribute; prefer rel="alternate" if present.
      link =
        attr(block, 'link', 'href') ||
        link;
      link = decodeEntities(link).trim();
    }
    if (!title || !link) continue;

    const guid = stripHtml(stripCdata(tag(block, 'guid') || tag(block, 'id')));
    const pub =
      stripCdata(tag(block, 'pubDate')) ||
      stripCdata(tag(block, 'published')) ||
      stripCdata(tag(block, 'updated')) ||
      stripCdata(tag(block, 'dc:date'));
    const rawSummary =
      tag(block, 'description') ||
      tag(block, 'content:encoded') ||
      tag(block, 'summary') ||
      tag(block, 'content');
    const summary = stripHtml(stripCdata(rawSummary));

    items.push({
      id: makeId('rss', `${source}:${guid || link || title}`),
      title,
      url: link,
      source,
      publishedAt: toIso(pub),
      summary: clampSummary(summary),
      imageUrl: extractImage(block),
      tags: extractTags(block),
    });
  }

  return items;
}

async function fetchRssSource(src: RssSource): Promise<NewsItem[]> {
  for (const url of src.urls) {
    try {
      const res = await fetchWithTimeout(
        url,
        'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      );
      if (!res.ok) {
        console.warn(`[news] ${src.source} ${url} -> ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRss(xml, src.source);
      if (items.length > 0) return items;
      console.warn(`[news] ${src.source} ${url} -> 0 items`);
    } catch (err) {
      console.warn(`[news] ${src.source} ${url} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return [];
}

// ── CryptoCompare (keyless JSON) ─────────────────────────────────────────────
interface CcNewsItem {
  id?: string | number;
  guid?: string;
  title?: string;
  url?: string;
  body?: string;
  imageurl?: string;
  source?: string;
  source_info?: { name?: string };
  published_on?: number;
  categories?: string;
  tags?: string;
}

// CryptoCompare publisher names vary in casing/slug form; canonicalise the
// common ones so their chips align with our RSS source labels (better dedupe
// and a tidier filter row). Unknown publishers pass through untouched.
const CC_SOURCE_CANON: Record<string, string> = {
  cointelegraph: 'CoinTelegraph',
  coindesk: 'CoinDesk',
  decrypt: 'Decrypt',
  theblock: 'The Block',
  'the block': 'The Block',
  bankless: 'Bankless',
  watcherguru: 'WatcherGuru',
  'watcher guru': 'WatcherGuru',
};

function canonSource(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, ' ').trim();
  return CC_SOURCE_CANON[key] ?? CC_SOURCE_CANON[key.replace(/\s+/g, '')] ?? name;
}

async function fetchCryptoCompare(): Promise<NewsItem[]> {
  try {
    const res = await fetchWithTimeout(
      'https://min-api.cryptocompare.com/data/v2/news/?lang=EN',
      'application/json, */*',
    );
    if (!res.ok) {
      console.warn(`[news] CryptoCompare -> ${res.status}`);
      return [];
    }
    const json: unknown = await res.json();
    const list =
      json && typeof json === 'object' && Array.isArray((json as { Data?: unknown }).Data)
        ? ((json as { Data: CcNewsItem[] }).Data)
        : [];
    const out: NewsItem[] = [];
    for (const raw of list) {
      const title = stripHtml(String(raw?.title ?? '')).trim();
      const url = String(raw?.url ?? '').trim();
      if (!title || !url) continue;
      const sourceName = canonSource(
        (raw?.source_info?.name && String(raw.source_info.name).trim()) ||
          (raw?.source && String(raw.source).trim()) ||
          'CryptoCompare',
      );
      const tags = String(raw?.categories ?? raw?.tags ?? '')
        .split(/[|,]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 4);
      out.push({
        id: makeId('cc', String(raw?.id ?? raw?.guid ?? url)),
        title,
        url,
        source: sourceName,
        publishedAt: toIso(raw?.published_on),
        summary: clampSummary(stripHtml(String(raw?.body ?? ''))),
        imageUrl: raw?.imageurl ? String(raw.imageurl) : null,
        tags,
      });
    }
    return out;
  } catch (err) {
    console.warn('[news] CryptoCompare failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── CoinGecko news (optional, only with a key) ───────────────────────────────
interface CgNewsItem {
  title?: string;
  url?: string;
  description?: string;
  thumb_2x?: string;
  news_site?: string;
  author?: string;
  updated_at?: number | string;
}

async function fetchCoinGecko(): Promise<NewsItem[]> {
  const key = process.env.COINGECKO_API_KEY;
  if (!key) return []; // optional source, silently skip without a key
  const plan = (process.env.COINGECKO_PLAN || '').toLowerCase();
  const isPro = plan === 'pro';
  const base = isPro ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
  const headerName = isPro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_SOURCE_TIMEOUT);
  try {
    const res = await fetch(`${base}/news`, {
      headers: { 'User-Agent': UA, Accept: 'application/json', [headerName]: key },
      signal: controller.signal,
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      console.warn(`[news] CoinGecko -> ${res.status}`);
      return [];
    }
    const json: unknown = await res.json();
    const list =
      json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)
        ? ((json as { data: CgNewsItem[] }).data)
        : [];
    const out: NewsItem[] = [];
    for (const raw of list) {
      const title = stripHtml(String(raw?.title ?? '')).trim();
      const url = String(raw?.url ?? '').trim();
      if (!title || !url) continue;
      out.push({
        id: makeId('cg', url),
        title,
        url,
        source: (raw?.news_site && String(raw.news_site).trim()) || 'CoinGecko',
        publishedAt: toIso(raw?.updated_at),
        summary: clampSummary(stripHtml(String(raw?.description ?? ''))),
        imageUrl: raw?.thumb_2x ? String(raw.thumb_2x) : null,
        tags: [],
      });
    }
    return out;
  } catch (err) {
    console.warn('[news] CoinGecko failed:', err instanceof Error ? err.message : err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ── dedupe + aggregate ───────────────────────────────────────────────────────
function titleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const path = u.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return url.toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '');
  }
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seenTitles = new Set<string>();
  const seenUrls = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    const tk = titleKey(item.title);
    const uk = urlKey(item.url);
    // Skip entries with too-short title keys only if the url also collides.
    if ((tk && seenTitles.has(tk)) || (uk && seenUrls.has(uk))) continue;
    if (tk) seenTitles.add(tk);
    if (uk) seenUrls.add(uk);
    out.push(item);
  }
  return out;
}

export async function aggregate(): Promise<NewsItem[]> {
  const results = await Promise.allSettled([
    ...RSS_SOURCES.map((s) => fetchRssSource(s)),
    fetchCryptoCompare(),
    fetchCoinGecko(),
  ]);

  const all: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  if (all.length === 0) throw new Error('All news sources failed or returned empty');

  // Sort newest-first; items without a parseable date sink to the bottom.
  all.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  return dedupe(all).slice(0, MAX_ITEMS);
}

// ── route ────────────────────────────────────────────────────────────────────
export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(
      { items: cache.data, count: cache.data.length },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } },
    );
  }

  try {
    const items = await aggregate();
    cache = { data: items, ts: Date.now() };
    return NextResponse.json(
      { items, count: items.length },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } },
    );
  } catch (err) {
    // Serve stale cache if we have it rather than a hard error.
    if (cache && cache.data.length > 0) {
      return NextResponse.json(
        { items: cache.data, count: cache.data.length, stale: true },
        { headers: { 'Cache-Control': 'public, max-age=30' } },
      );
    }
    const message = err instanceof Error ? err.message : 'Failed to load news';
    return NextResponse.json({ items: [], count: 0, error: message }, { status: 502 });
  }
}
