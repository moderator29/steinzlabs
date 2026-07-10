import 'server-only';
import { aggregate, type NewsItem } from '@/app/api/news/route';
import { newsMessage, type NewsHeadline, type TelegramRender, type TelegramStyle } from '@/lib/telegram/templates';

/**
 * News-to-Telegram helper.
 *
 * Reuses the SAME multi-source aggregator that powers the in-app News tab
 * (CoinTelegraph, WatcherGuru, Decrypt, The Block, Bankless, CoinDesk,
 * CryptoCompare, CoinGecko). Real headlines only — if aggregation yields
 * nothing, this returns null and the caller must NOT send anything (never
 * fabricate a "news drop").
 *
 * `signature` is a stable hash of the exact headline set. Callers store the
 * last signature they delivered per user and skip when it's unchanged, so the
 * same edition never lands twice (idempotent, non-spammy). Because the set only
 * changes when the underlying headlines rotate, a "sticky" #1 story with fresh
 * runners-up still produces a new signature and goes out once.
 */
export interface NewsDrop {
  headlines: NewsHeadline[];
  signature: string;
}

export async function fetchNewsDrop(limit = 8): Promise<NewsDrop | null> {
  let items: NewsItem[] = [];
  try {
    items = await aggregate();
  } catch {
    return null;
  }
  const top = items.slice(0, limit);
  if (top.length === 0) return null;

  const headlines: NewsHeadline[] = top.map((it) => ({
    title: it.title,
    url: it.url,
    source: it.source,
    publishedAt: it.publishedAt || null,
  }));

  const signature = headlines.map((h) => h.url).join('|');
  return { headlines, signature };
}

/**
 * Render a news drop into a ready-to-send Telegram message. Thin wrapper over
 * the template so the digest cron / broadcast can share one formatter.
 */
export function renderNewsDrop(
  drop: NewsDrop,
  style: TelegramStyle = 'normal',
  opts: { heading?: string; limit?: number } = {},
): TelegramRender {
  return newsMessage(drop.headlines, style, opts);
}
