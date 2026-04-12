import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { universalSearch } from '@/lib/search/universalSearch';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter required' },
        { status: 400 }
      );
    }

    const results = await universalSearch(query);

    return NextResponse.json({
      results,
      count: results.length,
      query,
    });
  } catch (error: any) {

    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}
