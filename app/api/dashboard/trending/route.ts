import { NextResponse } from 'next/server';
import { getTrendingTokens } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const trending = await getTrendingTokens();
    return NextResponse.json({ coins: trending }, {
      headers: { 'Cache-Control': 'public, max-age=120, s-maxage=300' },
    });
  } catch (err) {
    console.error('[dashboard/trending]', err);
    return NextResponse.json({ coins: [] }, { status: 502 });
  }
}
