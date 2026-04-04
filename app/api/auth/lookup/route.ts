import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: users } = await admin.auth.admin.listUsers();

    const match = users?.users?.find(
      (u: any) => u.user_metadata?.username?.toLowerCase() === username.toLowerCase()
    );

    if (!match?.email) {
      return NextResponse.json({ error: 'No account found with that username.' }, { status: 404 });
    }

    return NextResponse.json({ email: match.email });
  } catch (err: any) {
    console.error('[Lookup] error:', err.message);
    return NextResponse.json({ error: 'Unable to look up username.' }, { status: 500 });
  }
}
