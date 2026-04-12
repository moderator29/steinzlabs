import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { loadHolderIntelligence } from '@/lib/intelligence/holderAnalysis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const chain = request.nextUrl.searchParams.get('chain') || undefined;

    const intelligence = await loadHolderIntelligence(token, chain, 50);

    return NextResponse.json({
      bubbleMapData: intelligence.bubbleMapData,
      composition: intelligence.composition,
      safetyAnalysis: intelligence.safetyAnalysis,
      smartMoneyPresence: intelligence.smartMoneyPresence,
      scammerAnalysis: intelligence.scammerAnalysis,
      lastUpdated: intelligence.lastUpdated,
    });
  } catch (error: any) {

    return NextResponse.json(
      { error: error.message || 'Failed to load Bubblemaps data' },
      { status: 500 }
    );
  }
}
