import { NextRequest, NextResponse } from 'next/server';
import { loadHolderIntelligence } from '@/lib/intelligence/holderAnalysis';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const chain = request.nextUrl.searchParams.get('chain') || undefined;

    if (!token) {
      return NextResponse.json(
        { error: 'Token parameter required' },
        { status: 400 }
      );
    }

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
    console.error('Failed to load Bubblemaps data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Bubblemaps data' },
      { status: 500 }
    );
  }
}
