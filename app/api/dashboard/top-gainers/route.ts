import { NextResponse } from 'next/server';
import { getTopGainers } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '8', 10) || 8, 1), 25);
  try {
    const gainers = await getTopGainers(limit);
    return NextResponse.json({ tokens: gainers }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
    });
  } catch (err) {
    console.error('[dashboard/top-gainers]', err);
    return NextResponse.json({ tokens: [] }, { status: 502 });
  }
}
