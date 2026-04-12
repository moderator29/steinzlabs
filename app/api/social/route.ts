import 'server-only';
/**
 * STEINZ LABS — Social Intelligence API
 * Powered by LunarCrush — social data for any crypto asset
 *
 * GET /api/social?coin=BTC                → full social metrics for BTC
 * GET /api/social?coin=ETH&type=posts     → recent social posts
 * GET /api/social?coin=SOL&type=influencers → top influencers
 * GET /api/social?coin=BTC&type=timeseries  → historical social data
 * GET /api/social?type=trending           → trending coins by social score
 * GET /api/social?coins=BTC,ETH,SOL       → batch social metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCoinSocials,
  getCoinPosts,
  getCoinInfluencers,
  getCoinTimeSeries,
  getTrendingSocial,
  getBatchSocials,
  isLunarCrushConfigured,
} from '@/lib/lunarcrush';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coin    = searchParams.get('coin')?.toUpperCase();
  const coins   = searchParams.get('coins');
  const type    = searchParams.get('type') || 'overview';
  const limit   = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
  const interval = (searchParams.get('interval') || '1d') as '1h' | '1d' | '1w';

  if (!isLunarCrushConfigured()) {
    return NextResponse.json(
      { error: 'Social intelligence not configured. Add LUNARCRUSH_API_1 to environment variables.' },
      { status: 503 }
    );
  }

  try {
    // Trending coins by social activity
    if (type === 'trending' && !coin && !coins) {
      const trending = await getTrendingSocial(limit);
      return NextResponse.json({ data: trending, type: 'trending', count: trending.length }, {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
      });
    }

    // Batch: multiple coins
    if (coins && !coin) {
      const symbols = coins.split(',').map(s => s.trim().toUpperCase()).slice(0, 10);
      const batch = await getBatchSocials(symbols);
      return NextResponse.json({ data: batch, type: 'batch', count: Object.keys(batch).length }, {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
      });
    }

    if (!coin) {
      return NextResponse.json({ error: 'Provide coin= or coins= query param' }, { status: 400 });
    }

    switch (type) {
      case 'posts': {
        const posts = await getCoinPosts(coin, limit);
        return NextResponse.json({ data: posts, coin, type: 'posts', count: posts.length }, {
          headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
        });
      }

      case 'influencers': {
        const influencers = await getCoinInfluencers(coin, limit);
        return NextResponse.json({ data: influencers, coin, type: 'influencers', count: influencers.length }, {
          headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
      }

      case 'timeseries': {
        const ts = await getCoinTimeSeries(coin, interval);
        return NextResponse.json({ data: ts, coin, type: 'timeseries', interval, count: ts.length }, {
          headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
      }

      default: { // overview
        const socials = await getCoinSocials(coin);
        if (!socials) {
          return NextResponse.json(
            { error: `Social data not available for ${coin}` },
            { status: 404 }
          );
        }
        return NextResponse.json({ data: socials, coin, type: 'overview' }, {
          headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
        });
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Social data fetch failed' }, { status: 500 });
  }
}
