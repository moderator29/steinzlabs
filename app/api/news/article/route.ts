import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

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

// ─── SSRF guard ────────────────────────────────────────────────────────────────
// The reader fetches an arbitrary remote URL, so it MUST NOT be usable to reach
// the cloud metadata endpoint (169.254.169.254), loopback, or any private host.
// We (1) allow only http(s), (2) reject any host that is — or resolves to — a
// private/loopback/link-local/CGNAT address (across every IPv4/IPv6 notation),
// and (3) follow redirects manually, re-validating each hop, so a public URL
// can't 3xx-bounce us onto an internal target.

/** True if an IP literal falls in a range we must never fetch from. */
function isBlockedIp(ipRaw: string): boolean {
  let ip = ipRaw.trim().toLowerCase();
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed → block
    const [a, b] = p;
    if (a === 0 || a === 127 || a === 10) return true;          // this-host, loopback, private
    if (a === 169 && b === 254) return true;                     // link-local (metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;            // 172.16/12 private
    if (a === 192 && b === 168) return true;                     // 192.168/16 private
    if (a === 100 && b >= 64 && b <= 127) return true;           // 100.64/10 CGNAT
    if (a >= 224) return true;                                   // multicast / reserved
    return false;
  }
  if (v === 6) {
    // Normalize IPv4-mapped (::ffff:a.b.c.d) down to the v4 check.
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    if (ip === '::1' || ip === '::') return true;                // loopback / unspecified
    if (ip.startsWith('fe80') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true; // link-local
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // unique-local
    if (ip.startsWith('ff')) return true;                        // multicast
    return false;
  }
  return true; // not a valid IP literal → let the caller resolve DNS instead
}

/** Validate protocol + resolve the host and reject if any resolved IP is private. */
async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  // Strip IPv6 brackets; normalize.
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
  // If the host is an IP literal, check it directly.
  if (isIP(host)) return isBlockedIp(host) ? null : u;
  // Otherwise resolve every A/AAAA record and reject if ANY is private
  // (defense against a public name that points inward, and DNS rebinding).
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length) return null;
    if (addrs.some((a) => isBlockedIp(a.address))) return null;
  } catch {
    return null; // unresolvable → refuse
  }
  return u;
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

/**
 * Fetch with redirects followed MANUALLY so every hop is re-validated by
 * safeUrl (a public URL can otherwise 3xx-bounce onto an internal host).
 */
async function safeFetch(start: URL, signal: AbortSignal): Promise<Response | null> {
  let current: URL | null = start;
  for (let hop = 0; hop < 4 && current; hop++) {
    const res: Response = await fetch(current.toString(), {
      signal,
      cache: 'no-store',
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = await safeUrl(new URL(loc, current).toString());
      continue; // re-validated target; follow it next iteration
    }
    return res;
  }
  return null; // too many hops or a redirect resolved to a blocked host
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') || '';
  const u = await safeUrl(raw);
  if (!u) return NextResponse.json({ ok: false, reason: 'invalid url' }, { status: 200 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  let html = '';
  try {
    const res = await safeFetch(u, controller.signal);
    if (!res || !res.ok) return NextResponse.json({ ok: false, reason: res ? `upstream ${res.status}` : 'blocked redirect', url: u.toString() }, { status: 200 });
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
