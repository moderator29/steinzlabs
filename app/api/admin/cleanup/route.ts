import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// One-time cleanup route — DELETE THIS FILE after use
// Call: /api/admin/cleanup?secret=STEINZ_CLEANUP_2026

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');

  if (secret !== 'STEINZ_CLEANUP_2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // Step 1: Get all users
    const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      return NextResponse.json({ error: `Failed to list users: ${listError.message}` }, { status: 500 });
    }

    const users = usersData?.users || [];
    const total = users.length;

    // Step 2: Delete all profiles
    const { error: profilesError } = await admin.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (profilesError) {
      console.error('[Cleanup] Profiles delete error:', profilesError.message);
    }

    // Step 3: Delete all auth users
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const user of users) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) {
        failed.push(user.email || user.id);
      } else {
        deleted.push(user.email || user.id);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_found: total,
        deleted: deleted.length,
        failed: failed.length,
        deleted_accounts: deleted,
        failed_accounts: failed,
      },
      message: `Cleaned up ${deleted.length} of ${total} users. Platform is now fresh.`,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
