import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * 4chan /biz/ ticker-mention scraper. Reads the public catalog.json (no
 * auth, no scraping HTML), pulls subject + comment text from every thread,
 * regex-extracts $TICKER mentions, and rolls them up into social_discovery
 * keyed by symbol with a 1h window.
 *
 * Filtering:
 *  - Only $XYZ patterns 2-6 chars uppercase
 *  - Skip obvious noise (THIS, GAY, FAG, NSFW etc. — short curated blocklist)
 *  - Honor X-Stale-If-Error semantics: if upstream is down, no-op
 *
 * The data isn't meant to be authoritative — it's a discovery surface that
 * triangulates with on-chain smart-money buys to find tokens before they
 * trend.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CATALOG_URL = 'https://a.4cdn.org/biz/catalog.json';
const TICKER_RE = /\$([A-Z]{2,6})\b/g;
const BLOCKLIST = new Set([
  'THIS', 'GAY', 'FAG', 'KEK', 'NSFW', 'OP', 'TL', 'DR', 'IPO', 'CEO', 'CFO',
  'USD', 'EUR', 'CAD', 'GBP', 'JPY', 'CNY',
  // common false-positives
  'YOU', 'WE', 'HE', 'SHE', 'IT', 'US', 'THE',
]);

interface CatalogThread {
  no: number;
  sub?: string;
  com?: string;
  replies?: number;
}

interface CatalogPage {
  threads?: CatalogThread[];
}

function extractTickers(text: string): string[] {
  const out: string[] = [];
  const m = text.matchAll(TICKER_RE);
  for (const match of m) {
    const t = match[1];
    if (!BLOCKLIST.has(t)) out.push(t);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(req);
  if (!auth.ok) return auth.response!;

  let pages: CatalogPage[] = [];
  try {
    const res = await fetch(CATALOG_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'NakaLabs/1.0 (discovery)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return cronResponse('biz-mention-scrape', startedAt, { skipped: `upstream_${res.status}` });
    }
    pages = (await res.json()) as CatalogPage[];
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'biz-mention-scrape' } });
    return cronResponse('biz-mention-scrape', startedAt, { skipped: 'fetch_failed' });
  }

  // Aggregate per-symbol mention + thread counts across the entire catalog.
  const bySymbol = new Map<string, { mentions: number; threads: Set<number> }>();
  for (const page of pages ?? []) {
    for (const t of page.threads ?? []) {
      const text = `${t.sub ?? ''} ${t.com ?? ''}`.replace(/<[^>]+>/g, ' ');
      const tickers = extractTickers(text);
      if (tickers.length === 0) continue;
      const seenInThread = new Set<string>();
      for (const sym of tickers) {
        if (!bySymbol.has(sym)) bySymbol.set(sym, { mentions: 0, threads: new Set() });
        const bucket = bySymbol.get(sym)!;
        bucket.mentions += 1;
        if (!seenInThread.has(sym)) {
          bucket.threads.add(t.no);
          seenInThread.add(sym);
        }
      }
    }
  }

  if (bySymbol.size === 0) return cronResponse('biz-mention-scrape', startedAt, { rows: 0 });

  const admin = getSupabaseAdmin();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);

  // Compute velocity_score against the previous run's mention count for the
  // same symbol so a ticker that surged in the last hour ranks higher than
  // one that's been consistently mentioned.
  const symbols = Array.from(bySymbol.keys());
  const { data: prior } = await admin
    .from('social_discovery')
    .select('symbol, mention_count, window_end')
    .eq('source', 'biz_4chan')
    .in('symbol', symbols)
    .order('window_end', { ascending: false })
    .limit(symbols.length * 2);

  const priorBySym = new Map<string, number>();
  for (const r of prior ?? []) {
    if (r.symbol && !priorBySym.has(r.symbol)) priorBySym.set(r.symbol, Number(r.mention_count ?? 0));
  }

  const rows = symbols
    .filter((sym) => (bySymbol.get(sym)?.mentions ?? 0) >= 2)   // suppress single-mention noise
    .map((sym) => {
      const cur = bySymbol.get(sym)!;
      const prev = priorBySym.get(sym) ?? 0;
      const velocity_score = prev > 0 ? ((cur.mentions - prev) / prev) * 100 : cur.mentions * 10;
      return {
        source: 'biz_4chan' as const,
        symbol: sym,
        token_address: null,
        chain: null,
        mention_count: cur.mentions,
        thread_count: cur.threads.size,
        velocity_score,
        window_start: windowStart.toISOString(),
        window_end: now.toISOString(),
        metadata: {},
      };
    });

  if (rows.length === 0) return cronResponse('biz-mention-scrape', startedAt, { rows: 0 });

  const { error } = await admin.from('social_discovery').insert(rows);
  if (error) {
    Sentry.captureException(error, { tags: { cron: 'biz-mention-scrape' } });
    return cronResponse('biz-mention-scrape', startedAt, { error: error.message });
  }
  return cronResponse('biz-mention-scrape', startedAt, { rows: rows.length });
}
