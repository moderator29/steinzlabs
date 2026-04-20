import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public translate proxy. Two providers in fallback order:
//  1. Google Translate's gtx endpoint (unofficial, no key, high-quality)
//  2. MyMemory (rate-limited per-IP, solid for short strings)
//
// Responses are cached in-memory for 10 minutes by (target,text) so repeated
// lookups for the same string don't burn quota.

interface ReqBody {
  text: string | string[];
  target: string;
  source?: string;
}

const CACHE = new Map<string, { value: string; exp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheGet(key: string): string | null {
  const v = CACHE.get(key);
  if (!v) return null;
  if (Date.now() > v.exp) { CACHE.delete(key); return null; }
  return v.value;
}
function cacheSet(key: string, value: string) {
  CACHE.set(key, { value, exp: Date.now() + CACHE_TTL_MS });
  if (CACHE.size > 5000) {
    // Soft trim: clear expired entries first, then oldest insertions.
    const now = Date.now();
    for (const [k, v] of CACHE) if (v.exp < now) CACHE.delete(k);
    while (CACHE.size > 4000) { const first = CACHE.keys().next().value; if (!first) break; CACHE.delete(first); }
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); });
  try { return await Promise.race([p, t]); } finally { if (timer) clearTimeout(timer); }
}

async function viaGoogleGtx(text: string, source: string, target: string): Promise<string | null> {
  try {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', source);
    url.searchParams.set('tl', target);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NakaLabs/1.0)' },
    });
    if (!res.ok) return null;
    const json = await res.json() as unknown;
    // Google returns: [[[translated, original, null, null, ...], ...], null, 'en']
    if (!Array.isArray(json) || !Array.isArray(json[0])) return null;
    const chunks: string[] = [];
    for (const row of json[0]) {
      if (Array.isArray(row) && typeof row[0] === 'string') chunks.push(row[0]);
    }
    const joined = chunks.join('');
    return joined || null;
  } catch {
    return null;
  }
}

async function viaMyMemory(text: string, source: string, target: string): Promise<string | null> {
  try {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `${source}|${target}`);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = await res.json() as { responseData?: { translatedText?: string }; responseStatus?: number };
    if (json.responseStatus && json.responseStatus !== 200) return null;
    return json.responseData?.translatedText ?? null;
  } catch {
    return null;
  }
}

async function translateOne(text: string, source: string, target: string): Promise<string> {
  if (!text || source === target) return text;
  const key = `${source}|${target}|${text}`;
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  const primary = await withTimeout(viaGoogleGtx(text, source, target), 4500);
  if (primary) { cacheSet(key, primary); return primary; }

  const fallback = await withTimeout(viaMyMemory(text, source, target), 5000);
  if (fallback) { cacheSet(key, fallback); return fallback; }

  // Both providers failed — return original so UI degrades gracefully.
  return text;
}

function sanitizeLang(s: unknown): string {
  if (typeof s !== 'string') return 'en';
  const trimmed = s.trim().toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{2,4})?$/i.test(trimmed)) return 'en';
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const target = sanitizeLang(body.target);
    const source = sanitizeLang(body.source ?? 'auto');
    const input = Array.isArray(body.text) ? body.text : [body.text];
    const safe = input.filter(x => typeof x === 'string').slice(0, 50);
    const translations = await Promise.all(safe.map((t) => translateOne(t, source, target)));
    return NextResponse.json({
      translations,
      target,
      source: source === 'auto' ? 'auto' : source,
    }, {
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=1800' },
    });
  } catch (err) {
    console.error('[translate]', err);
    return NextResponse.json({ error: 'Translate failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get('q') ?? '';
  const target = sanitizeLang(searchParams.get('tl') ?? 'en');
  const source = sanitizeLang(searchParams.get('sl') ?? 'auto');
  if (!text) return NextResponse.json({ translated: '' });
  const translated = await translateOne(text, source, target);
  return NextResponse.json({ translated, source, target }, {
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=1800' },
  });
}
