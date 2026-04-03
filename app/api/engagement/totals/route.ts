import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : ''}http://localhost:5000/api/engagement?eventId=__totals__`);
    return NextResponse.json({ views: 0, likes: 0, shares: 0 });
  } catch {
    return NextResponse.json({ views: 0, likes: 0, shares: 0 });
  }
}
