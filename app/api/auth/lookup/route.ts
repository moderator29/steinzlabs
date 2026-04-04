import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email')
      .ilike('username', username)
      .limit(1)
      .single();

    if (profile?.email) {
      return NextResponse.json({ email: profile.email });
    }

    let page = 0;
    const perPage = 100;
    while (true) {
      const { data: usersData } = await admin.auth.admin.listUsers({
        page: page + 1,
        perPage,
      });

      if (!usersData?.users || usersData.users.length === 0) break;

      const match = usersData.users.find(
        (u: any) => u.user_metadata?.username?.toLowerCase() === username.toLowerCase()
      );

      if (match?.email) {
        return NextResponse.json({ email: match.email });
      }

      if (usersData.users.length < perPage) break;
      page++;
      if (page > 10) break;
    }

    return NextResponse.json({ error: 'No account found with that username.' }, { status: 404 });
  } catch (err: any) {
    console.error('[Lookup] error:', err.message);
    return NextResponse.json({ error: 'Unable to look up username.' }, { status: 500 });
  }
}
