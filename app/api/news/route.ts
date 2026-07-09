import 'server-only';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * News API — CoinTelegraph RSS as the spine.
 *
 * Fetches + parses https://cointelegraph.com/rss server-side (no key needed)
 * and normalises to a clean list. Cached in-memory ~120s so we do not hammer
 * the feed. Honest failure: 502 + empty list, never fabricated items.
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

const RSS_URL = 'https://cointelegraph.com/rss';
const CACHE_TTL = 120_000; // 120s
const MAX_ITEMS = 20;

let cache: { data: NewsItem[]; ts: number } | null = null;

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

// Pull an attribute value from the first self-closing / open tag of `name`.
function attr(block: string, name: string, attribute: string): string | null {
  const re = new RegExp(`<${name}\\b[^>]*?\\b${attribute}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i');
  const m = block.match(re);
  return m ? m[1] : null;
}

function extractImage(block: string): string | null {
  // CoinTelegraph exposes images via <media:content url="…"> and sometimes
  // <enclosure url="…" type="image/*">. Fall back to the first <img> in the body.
  const media = attr(block, 'media:content', 'url') || attr(block, 'media:thumbnail', 'url');
  if (media) return media;

  const encUrl = attr(block, 'enclosure', 'url');
  const encType = attr(block, 'enclosure', 'type');
  if (encUrl && (!encType || encType.startsWith('image'))) return encUrl;

  const desc = tag(block, 'description') || tag(block, 'content:encoded');
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

function toIso(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function makeId(guid: string, url: string, title: string): string {
  const basis = guid || url || title;
  // Stable, dependency-free hash.
  let h = 0;
  for (let i = 0; i < basis.length; i++) {
    h = (h << 5) - h + basis.charCodeAt(i);
    h |= 0;
  }
  return `ct_${Math.abs(h).toString(36)}`;
}

function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(xml)) !== null && items.length < 60) {
    const block = m[1];

    const title = stripHtml(stripCdata(tag(block, 'title')));
    const link = decodeEntities(stripCdata(tag(block, 'link'))).trim();
    if (!title || !link) continue;

    const guid = stripHtml(stripCdata(tag(block, 'guid')));
    const pub = stripCdata(tag(block, 'pubDate'));
    const rawSummary = tag(block, 'description') || tag(block, 'content:encoded');
    const summary = stripHtml(stripCdata(rawSummary));

    items.push({
      id: makeId(guid, link, title),
      title,
      url: link,
      source: 'CoinTelegraph',
      publishedAt: toIso(pub),
      summary: summary.length > 240 ? `${summary.slice(0, 237)}…` : summary,
      imageUrl: extractImage(block),
      tags: extractTags(block),
    });
  }

  return items;
}

async function fetchRss(): Promise<NewsItem[]> {
  const res = await fetch(RSS_URL, {
    headers: {
      // Some CDNs 403 requests without a UA / Accept.
      'User-Agent': 'SteinzLabs-News/1.0 (+https://steinzlabs.com)',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    next: { revalidate: 120 },
  });
  if (!res.ok) throw new Error(`CoinTelegraph RSS ${res.status}`);
  const xml = await res.text();
  const items = parseRss(xml);
  if (items.length === 0) throw new Error('CoinTelegraph RSS returned no items');
  return items;
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(
      { items: cache.data, count: cache.data.length },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } },
    );
  }

  try {
    const items = (await fetchRss()).slice(0, MAX_ITEMS);
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
