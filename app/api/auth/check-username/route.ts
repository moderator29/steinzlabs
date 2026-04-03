import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ available: false, error: 'Invalid username format' });
    }

    const adminClient = getSupabaseAdmin();
    const { data } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    return NextResponse.json({ available: !data });
  } catch {
    return NextResponse.json({ available: true });
  }
}
