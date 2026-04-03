import { NextRequest, NextResponse } from 'next/server';
import { loadHolderIntelligence } from '@/lib/intelligence/holderAnalysis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const chain = request.nextUrl.searchParams.get('chain') || undefined;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    console.log(`Loading holder intelligence for ${token}...`);

    const intelligence = await loadHolderIntelligence(token, chain, limit);

    return NextResponse.json(intelligence);
  } catch (error: any) {
    console.error('Failed to load holder intelligence:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load holder intelligence' },
      { status: 500 }
    );
  }
}
