import 'server-only';
import { lunarCrushRotation, RateLimitError } from '../api/rotation-manager';
import { cache, cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * LunarCrush Social Intelligence Service
 * Uses 4-key rotation — should never hit rate limits with proper cycling.
 */

const BASE = 'https://lunarcrush.com/api4/public';

async function lunarFetch(endpoint: string): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    let apiKey: string;
    try {
      apiKey = lunarCrushRotation.getNextKey();
    } catch (e) {
      throw e;
    }

    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 429) {
        lunarCrushRotation.markRateLimited(apiKey, 60_000);
        continue;
      }

      if (!res.ok) {
        lastError = new Error(`LunarCrush error: ${res.status}`);
        continue;
      }

      return res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('LunarCrush: all attempts failed');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LunarCrushSocialScore {
  symbol: string;
  name: string;
  galaxyScore: number;         // 0-100 overall health
  altRank: number;             // rank vs all crypto
  socialVolume24h: number;     // posts in last 24h
  sentimentScore: number;      // -100 to 100 (derived from 1-5 scale)
  socialDominance: number;     // % of total crypto social volume
  influencerCount: number;
  bullishPercent?: number;
  bearishPercent?: number;
  trendingRank?: number;
}

export interface LunarCrushTrend {
  id: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  galaxyScore: number;
  socialVolume: number;
  altRank: number;
}

export interface SocialDataPoint {
  time: number;               // unix timestamp
  socialVolume: number;
  socialScore: number;
  price: number;
}

export interface InfluencerPost {
  id: string;
  creator: string;
  platform: string;
  content: string;
  engagement: number;
  sentiment: number;
  timestamp: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getSocialScore(symbol: string): Promise<LunarCrushSocialScore | null> {
  const key = cacheKey('lunarcrush', 'social_score', { symbol: symbol.toUpperCase() });
  return withCache(key, TTL.SOCIAL_SENTIMENT, async () => {
    try {
      const data = await lunarFetch(`/coins/${symbol.toLowerCase()}/v1`) as {
        data?: Record<string, unknown>;
      };
      const d = data?.data;
      if (!d) return null;

      const rawSentiment = (d.sentiment as number) ?? 3; // 1-5 scale
      const sentimentScore = Math.round(((rawSentiment - 3) / 2) * 100); // Convert to -100..100

      return {
        symbol: d.symbol as string ?? symbol,
        name: d.name as string ?? symbol,
        galaxyScore: d.galaxy_score as number ?? 0,
        altRank: d.alt_rank as number ?? 0,
        socialVolume24h: d.social_volume_24h as number ?? 0,
        sentimentScore,
        socialDominance: d.social_dominance as number ?? 0,
        influencerCount: d.unique_contributors as number ?? 0,
        bullishPercent: d.percent_change_sentiment_positive_24h as number | undefined,
        bearishPercent: d.percent_change_sentiment_negative_24h as number | undefined,
      };
    } catch {
      return null;
    }
  });
}

export async function getTrendingTokens(limit = 20): Promise<LunarCrushTrend[]> {
  const key = cacheKey('lunarcrush', 'trending', { limit });
  return withCache(key, TTL.SOCIAL_SENTIMENT, async () => {
    try {
      const data = await lunarFetch(`/coins/list/v2?sort=galaxy_score&limit=${limit}`) as {
        data?: Record<string, unknown>[];
      };
      return (data?.data ?? []).map(d => ({
        id: d.id as string ?? '',
        symbol: d.symbol as string ?? '',
        name: d.name as string ?? '',
        price: d.price as number ?? 0,
        priceChange24h: d.percent_change_24h as number ?? 0,
        galaxyScore: d.galaxy_score as number ?? 0,
        socialVolume: d.social_volume_24h as number ?? 0,
        altRank: d.alt_rank as number ?? 0,
      }));
    } catch {
      return [];
    }
  });
}

export async function getSocialTimeline(
  symbol: string,
  interval: '1h' | '1d' = '1d'
): Promise<SocialDataPoint[]> {
  const key = cacheKey('lunarcrush', 'timeline', { symbol: symbol.toUpperCase(), interval });
  return withCache(key, TTL.SOCIAL_SENTIMENT, async () => {
    try {
      const bucket = interval === '1h' ? 'hour' : 'day';
      const data = await lunarFetch(
        `/coins/${symbol.toLowerCase()}/time-series/v2?bucket=${bucket}&limit=48`
      ) as { data?: Record<string, unknown>[] };

      return (data?.data ?? []).map(d => ({
        time: d.time as number ?? 0,
        socialVolume: d.social_volume as number ?? 0,
        socialScore: d.galaxy_score as number ?? 0,
        price: d.open as number ?? 0,
      }));
    } catch {
      return [];
    }
  });
}

export interface SocialVelocity {
  symbol: string;
  tweets_6h: number;
  tweets_24h: number;
  // Rate-normalized: how much faster the last 6h is running vs the 24h
  // average. +400 means 5x the average hourly rate; 0 means on pace.
  velocity_pct: number;
  // Galaxy-score delta over the same 6h window vs the prior 6h. Positive
  // = sentiment improving, negative = deteriorating. Range typically -50..+50.
  sentiment_shift: number;
}

export async function getSocialVelocity(symbol: string): Promise<SocialVelocity | null> {
  const key = cacheKey('lunarcrush', 'velocity_6h', { symbol: symbol.toUpperCase() });
  return withCache(key, TTL.SOCIAL_SENTIMENT, async () => {
    const series = await getSocialTimeline(symbol, '1h');
    // Need at least 12 buckets (last-6h + prior-6h) to compute sentiment_shift.
    if (series.length < 12) return null;

    // Series comes oldest-first from LunarCrush; take the tail for the most
    // recent windows.
    const last6 = series.slice(-6);
    const prior6 = series.slice(-12, -6);
    const last24 = series.slice(-24);

    const sum = (rows: SocialDataPoint[], key: keyof SocialDataPoint) =>
      rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    const avg = (rows: SocialDataPoint[], key: keyof SocialDataPoint) =>
      rows.length ? sum(rows, key) / rows.length : 0;

    const tweets_6h = sum(last6, 'socialVolume');
    const tweets_24h = sum(last24, 'socialVolume');

    // Hourly rate over the 6h window vs the 24h baseline hourly rate.
    const last6Rate = tweets_6h / 6;
    const base24Rate = tweets_24h / 24;
    const velocity_pct = base24Rate > 0 ? Math.round(((last6Rate / base24Rate) - 1) * 100) : 0;

    const sentiment_shift = Math.round(avg(last6, 'socialScore') - avg(prior6, 'socialScore'));

    return { symbol: symbol.toUpperCase(), tweets_6h, tweets_24h, velocity_pct, sentiment_shift };
  });
}

export async function getInfluencerActivity(symbol: string): Promise<InfluencerPost[]> {
  const key = cacheKey('lunarcrush', 'influencers', { symbol: symbol.toUpperCase() });
  return withCache(key, TTL.SOCIAL_SENTIMENT, async () => {
    try {
      const data = await lunarFetch(
        `/coins/${symbol.toLowerCase()}/influencers/v2?limit=10`
      ) as { data?: Record<string, unknown>[] };

      return (data?.data ?? []).slice(0, 10).map(d => ({
        id: String(d.id ?? ''),
        creator: d.name as string ?? '',
        platform: d.type as string ?? 'twitter',
        content: d.body as string ?? '',
        engagement: d.interactions_24h as number ?? 0,
        sentiment: d.sentiment as number ?? 3,
        timestamp: d.time as number ?? 0,
      }));
    } catch {
      return [];
    }
  });
}
