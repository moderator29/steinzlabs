import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { submitGasless } from '@/lib/services/zerox';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const result = await submitGasless(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gasless submit failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
