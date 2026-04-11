import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: { users } } = await admin.auth.admin.listUsers();
    const user = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    return NextResponse.json({ success: true });
  } catch (err: any) {

    return NextResponse.json({ error: 'Failed to confirm user' }, { status: 500 });
  }
}
