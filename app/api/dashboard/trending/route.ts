import { NextResponse } from 'next/server';
import { getTrendingTokens, type TrendingCoin } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

async function withDeadline<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  try { return await Promise.race([p, t]); } finally { if (timer) clearTimeout(timer); }
}

export async function GET() {
  try {
    const trending = await withDeadline<TrendingCoin[]>(getTrendingTokens(), 8000, []);
    return NextResponse.json({ coins: trending }, {
      headers: { 'Cache-Control': 'public, max-age=120, s-maxage=300' },
    });
  } catch (err) {
    console.error('[dashboard/trending]', err);
    return NextResponse.json({ coins: [] }, { status: 502 });
  }
}
