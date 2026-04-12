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
