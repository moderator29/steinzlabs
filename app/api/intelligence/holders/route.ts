import { NextRequest, NextResponse } from 'next/server';
import { loadHolderIntelligence } from '@/lib/intelligence/holderAnalysis';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const chain = request.nextUrl.searchParams.get('chain') || undefined;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    if (!token) {
      return NextResponse.json(
        { error: 'Token parameter required' },
        { status: 400 }
      );
    }



    const intelligence = await loadHolderIntelligence(token, chain, limit);

    return NextResponse.json(intelligence);
  } catch (error: any) {

    return NextResponse.json(
      { error: error.message || 'Failed to load holder intelligence' },
      { status: 500 }
    );
  }
}
