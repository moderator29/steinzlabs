import 'server-only';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Delete user data from all tables
    await Promise.allSettled([
      admin.from('profiles').delete().eq('id', user.id),
      admin.from('user_preferences').delete().eq('user_id', user.id),
      admin.from('watchlist').delete().eq('user_id', user.id),
      admin.from('alerts').delete().eq('user_id', user.id),
      admin.from('vtx_conversations').delete().eq('user_id', user.id),
      admin.from('wallets').delete().eq('user_id', user.id),
    ]);

    // Delete the auth user
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('[account/delete] Auth delete failed:', deleteError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[account/delete] Failed:', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
