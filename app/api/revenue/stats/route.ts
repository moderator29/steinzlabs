import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTotalRevenue } from '@/lib/revenue/feeSystem';
import { verifyAdminContext } from '@/lib/auth/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // Platform-wide revenue is admin-only data. This previously accepted ANY
    // authenticated user, leaking totalRevenue/revenueByType/totalTrades to
    // every logged-in account.
    const ctx = await verifyAdminContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
