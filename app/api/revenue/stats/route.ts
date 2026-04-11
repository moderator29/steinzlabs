import { NextRequest, NextResponse } from 'next/server';
import { getTotalRevenue } from '@/lib/revenue/feeSystem';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

    const timeframe = startDate && endDate ? { startDate, endDate } : undefined;
    const stats = await getTotalRevenue(timeframe);

    return NextResponse.json(stats);
  } catch (error: any) {

    return NextResponse.json({ error: error.message || 'Failed to load revenue stats' }, { status: 500 });
  }
}
