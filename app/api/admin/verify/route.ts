import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

// Constant-time compare so this endpoint can't be used as a timing oracle
// to recover ADMIN_BEARER_TOKEN one byte at a time.
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = process.env.ADMIN_BEARER_TOKEN;

  if (!expected || !token || !tokenMatches(token, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
