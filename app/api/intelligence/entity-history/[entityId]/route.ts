import { NextRequest, NextResponse } from 'next/server';
import { getEntityHistory } from '@/lib/intelligence/historicalTracking';

export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const { entityId } = params;

    const history = await getEntityHistory(entityId);

    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get entity history' },
      { status: 500 }
    );
  }
}
