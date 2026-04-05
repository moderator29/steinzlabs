import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .ilike('username', username)
      .limit(1)
      .single();

    if (profile?.email) {
      return NextResponse.json({ email: profile.email });
    }

    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersData?.users) {
      const match = usersData.users.find(
        (u: any) => u.user_metadata?.username?.toLowerCase() === username.toLowerCase()
      );
      if (match?.email) {
        try {
          await admin.from('profiles').upsert({
            id: match.id,
            username: match.user_metadata?.username,
            email: match.email,
            first_name: match.user_metadata?.first_name || '',
            last_name: match.user_metadata?.last_name || '',
          }, { onConflict: 'id' });
        } catch {}
        return NextResponse.json({ email: match.email });
      }
    }

    return NextResponse.json({ error: 'No account found with that username.' }, { status: 404 });
  } catch (err: any) {
    console.error('[Lookup] error:', err.message);
    return NextResponse.json({ error: 'Unable to look up username.' }, { status: 500 });
  }
}
