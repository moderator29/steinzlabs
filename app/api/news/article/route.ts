import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

/**
 * In-platform article reader.
 * GET /api/news/article?url=<encoded>
 *
 * Fetches the source page and extracts a clean, readable version (title, hero
 * image, byline, paragraphs) so the story opens INSIDE the platform — the user
 * never leaves. Lightweight reader-mode extraction (no heavy deps). When a page
 * is paywalled or unparseable we return { ok:false } and the UI shows the
 * summary + an honest "open original" fallback.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// Only fetch http(s) URLs; block internal hosts (SSRF guard).
function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.|::1)/.test(host)) return null;
    return u;
  } catch {
    return null;
  }
}

function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
  return m ? decodeEntities(m[1]) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Pull readable paragraphs from the densest article region. */
function extractParagraphs(html: string): string[] {
  // Drop scripts/styles/nav/aside/figure captions first.
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  // Prefer an <article> region if present.
  const art = body.match(/<article[\s\S]*?<\/article>/i);
  if (art) body = art[0];
  const paras: string[] = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const text = stripTags(m[1]);
    // Real sentences only — skip nav/boilerplate scraps.
    if (text.length >= 60 && /[.!?]/.test(text)) paras.push(text);
    if (paras.length >= 60) break;
  }
  return paras;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') || '';
  const u = safeUrl(raw);
  if (!u) return NextResponse.json({ ok: false, reason: 'invalid url' }, { status: 200 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  let html = '';
  try {
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    if (!res.ok) return NextResponse.json({ ok: false, reason: `upstream ${res.status}`, url: u.toString() }, { status: 200 });
    html = await res.text();
  } catch {
    return NextResponse.json({ ok: false, reason: 'fetch failed', url: u.toString() }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }

  const title = meta(html, 'og:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '').trim() || null;
  const image = meta(html, 'og:image');
  const siteName = meta(html, 'og:site_name');
  const description = meta(html, 'og:description') || meta(html, 'description');
  const paragraphs = extractParagraphs(html);

  const ok = paragraphs.length >= 2;
  return NextResponse.json({
    ok,
    url: u.toString(),
    host: u.hostname.replace(/^www\./, ''),
    title,
    image,
    siteName,
    description,
    paragraphs,
  }, { status: 200 });
}
