/**
 * STEINZ LABS — LunarCrush Social Intelligence Client
 *
 * LunarCrush tracks social media activity (Twitter/X, Reddit, TikTok, YouTube,
 * news) for every crypto asset and turns it into quantifiable signals.
 *
 * 4 API keys are round-robined to maximize rate limits.
 *
 * Key metrics:
 *  Galaxy Score  — 0-100: overall health (social + market combined)
 *  AltRank       — rank vs all crypto on combined social+market performance
 *  Social Volume — number of posts in last 24h
 *  Sentiment     — 1(very bearish) to 5(very bullish), or % bullish
 *  Social Dominance — % of total crypto social volume this coin owns
 *  Influencer Count — unique creators posting about this coin
 */

const LUNARCRUSH_KEYS = [
  process.env.LUNARCRUSH_API_KEY_1,
  process.env.LUNARCRUSH_API_KEY_2,
  process.env.LUNARCRUSH_API_KEY_3,
  process.env.LUNARCRUSH_API_KEY_4,
].filter(Boolean) as string[];

// Round-robin key index
let keyIndex = 0;
function getKey(): string | null {
  if (LUNARCRUSH_KEYS.length === 0) return null;
  const key = LUNARCRUSH_KEYS[keyIndex % LUNARCRUSH_KEYS.length];
  keyIndex++;
  return key;
}

const BASE = 'https://lunarcrush.com/api4/public';

// In-memory cache to avoid hammering the API (2 min TTL)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 2 * 60 * 1000;

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
}

async function lunarFetch(endpoint: string): Promise<any> {
  const apiKey = getKey();
  if (!apiKey) return null;

  const cacheKey = endpoint;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      // Try next key on 429
      if (res.status === 429 && LUNARCRUSH_KEYS.length > 1) {
        keyIndex++; // skip to next key
        const retryKey = getKey();
        if (retryKey && retryKey !== apiKey) {
          const retryRes = await fetch(`${BASE}${endpoint}`, {
            headers: { Authorization: `Bearer ${retryKey}` },
            cache: 'no-store',
          });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            setCache(cacheKey, retryData);
            return retryData;
          }
        }
      }
      return null;
    }
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoinSocials {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  galaxyScore: number;        // 0-100: overall health
  altRank: number;            // rank vs all crypto (lower = better)
  socialVolume24h: number;    // number of posts in 24h
  socialScore: number;        // engagement score
  socialDominance: number;    // % of total crypto social volume
  socialContributors: number; // unique users posting
  averageSentiment: number;   // 1-5 scale
  bullishPercent: number;     // % of posts that are bullish
  bearishPercent: number;     // % of posts that are bearish
  sentimentLabel: 'Extremely Bearish' | 'Bearish' | 'Neutral' | 'Bullish' | 'Extremely Bullish';
  marketCap: number;
  volume24h: number;
  logo?: string;
}

export interface SocialPost {
  id: string;
  type: 'tweet' | 'reddit' | 'news' | 'youtube' | 'tiktok';
  title: string;
  body?: string;
  url: string;
  creator: string;
  followers: number;
  engagement: number;
  sentiment: number; // 1-5
  createdAt: string;
}

export interface SocialInfluencer {
  name: string;
  username: string;
  platform: string;
  followers: number;
  engagement: number;
  sentiment: number;
  postsCount: number;
  influence: number; // 0-100
}

export interface TrendingSocial {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  galaxyScore: number;
  altRank: number;
  socialVolume24h: number;
  bullishPercent: number;
  logo?: string;
}

// ─── Functions ────────────────────────────────────────────────────────────────

function sentimentLabel(avg: number): CoinSocials['sentimentLabel'] {
  if (avg >= 4.5) return 'Extremely Bullish';
  if (avg >= 3.5) return 'Bullish';
  if (avg >= 2.5) return 'Neutral';
  if (avg >= 1.5) return 'Bearish';
  return 'Extremely Bearish';
}

/**
 * Get social intelligence for a single coin by symbol (e.g. "BTC", "ETH")
 */
export async function getCoinSocials(symbol: string): Promise<CoinSocials | null> {
  const data = await lunarFetch(`/coins/${symbol.toLowerCase()}/v1`);
  if (!data?.data) return null;
  const d = data.data;
  const bullish = d.percent_bullish ?? (d.average_sentiment >= 3 ? 60 : 40);
  const bearish = 100 - bullish;
  return {
    symbol: d.symbol || symbol.toUpperCase(),
    name: d.name || symbol,
    price: d.price || 0,
    priceChange24h: d.percent_change_24h || 0,
    galaxyScore: Math.round(d.galaxy_score || 0),
    altRank: d.alt_rank || 9999,
    socialVolume24h: d.social_volume_24h || d.social_volume || 0,
    socialScore: Math.round(d.social_score || 0),
    socialDominance: d.social_dominance || 0,
    socialContributors: d.social_contributors || d.unique_contributors || 0,
    averageSentiment: d.average_sentiment || 3,
    bullishPercent: bullish,
    bearishPercent: bearish,
    sentimentLabel: sentimentLabel(d.average_sentiment || 3),
    marketCap: d.market_cap || 0,
    volume24h: d.volume_24h || 0,
    logo: d.logo || undefined,
  };
}

/**
 * Get trending coins ranked by social activity
 */
export async function getTrendingSocial(limit = 20): Promise<TrendingSocial[]> {
  const data = await lunarFetch(`/coins/list/v1?sort=galaxy_score&limit=${limit}&desc=true`);
  if (!data?.data) return [];
  return data.data.map((d: any) => ({
    symbol: d.symbol || '',
    name: d.name || '',
    price: d.price || 0,
    priceChange24h: d.percent_change_24h || 0,
    galaxyScore: Math.round(d.galaxy_score || 0),
    altRank: d.alt_rank || 9999,
    socialVolume24h: d.social_volume_24h || d.social_volume || 0,
    bullishPercent: d.percent_bullish || 50,
    logo: d.logo || undefined,
  }));
}

/**
 * Get top social posts for a coin
 */
export async function getCoinPosts(symbol: string, limit = 10): Promise<SocialPost[]> {
  const data = await lunarFetch(`/topic/${symbol.toLowerCase()}/posts/v1?limit=${limit}`);
  if (!data?.data) return [];
  return data.data.slice(0, limit).map((p: any) => ({
    id: String(p.id || p.post_id || Math.random()),
    type: (p.post_type || p.type || 'tweet').toLowerCase() as SocialPost['type'],
    title: p.post_title || p.title || p.body?.slice(0, 100) || '',
    body: p.body || p.post_body || undefined,
    url: p.post_link || p.url || '',
    creator: p.creator_display_name || p.creator || 'Unknown',
    followers: p.creator_followers || 0,
    engagement: p.interactions || p.engagement || 0,
    sentiment: p.post_sentiment || 3,
    createdAt: p.post_created ? new Date(p.post_created * 1000).toISOString() : new Date().toISOString(),
  }));
}

/**
 * Get top influencers talking about a coin
 */
export async function getCoinInfluencers(symbol: string, limit = 10): Promise<SocialInfluencer[]> {
  const data = await lunarFetch(`/coins/${symbol.toLowerCase()}/influencers/v1?limit=${limit}`);
  if (!data?.data) return [];
  return data.data.slice(0, limit).map((inf: any) => ({
    name: inf.display_name || inf.name || 'Unknown',
    username: inf.screen_name || inf.username || '',
    platform: inf.type || 'twitter',
    followers: inf.followers || 0,
    engagement: inf.engagement || 0,
    sentiment: inf.average_sentiment || 3,
    postsCount: inf.posts || 0,
    influence: Math.min(100, Math.round((inf.influence_score || inf.engagement || 0) / 1000)),
  }));
}

/**
 * Get time-series social data for charting (galaxy score over time)
 */
export async function getCoinTimeSeries(symbol: string, interval: '1h' | '1d' | '1w' = '1d'): Promise<Array<{ ts: number; galaxyScore: number; socialVolume: number; sentiment: number; price: number }>> {
  const bucket = interval === '1h' ? 'hour' : interval === '1w' ? 'week' : 'day';
  const data = await lunarFetch(`/coins/${symbol.toLowerCase()}/time-series/v1?bucket=${bucket}&limit=30`);
  if (!data?.data) return [];
  return data.data.map((d: any) => ({
    ts: (d.time || d.ts) * 1000,
    galaxyScore: Math.round(d.galaxy_score || 0),
    socialVolume: d.social_volume || 0,
    sentiment: d.average_sentiment || 3,
    price: d.close || d.price || 0,
  }));
}

/**
 * Batch fetch socials for multiple coins efficiently
 */
export async function getBatchSocials(symbols: string[]): Promise<Record<string, CoinSocials>> {
  const results = await Promise.allSettled(
    symbols.slice(0, 10).map(sym => getCoinSocials(sym))
  );
  const map: Record<string, CoinSocials> = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      map[symbols[i].toUpperCase()] = r.value;
    }
  });
  return map;
}

/**
 * Quick format for VTX AI context injection
 */
export async function getLunarCrushContextForAI(symbols: string[]): Promise<string> {
  if (LUNARCRUSH_KEYS.length === 0) return '';
  try {
    const socials = await getBatchSocials(symbols);
    if (Object.keys(socials).length === 0) return '';
    const lines = Object.values(socials).map(s =>
      `${s.symbol}: Galaxy Score ${s.galaxyScore}/100 | AltRank #${s.altRank} | Social Volume ${s.socialVolume24h.toLocaleString()} posts | Sentiment ${s.sentimentLabel} (${s.bullishPercent.toFixed(0)}% bullish) | Social Dominance ${s.socialDominance.toFixed(1)}%`
    );
    return `SOCIAL INTELLIGENCE (LunarCrush):\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

export function isLunarCrushConfigured(): boolean {
  return LUNARCRUSH_KEYS.length > 0;
}
