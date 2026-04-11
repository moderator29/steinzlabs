import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { validateResetToken } from '@/lib/authTokens';

export async function POST(request: Request) {
  try {
    const { token, uid, password } = await request.json();

    if (!token || !uid || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length < 8 || password.length > 100) {
      return NextResponse.json({ error: 'Password must be between 8 and 100 characters' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: { user }, error: userError } = await admin.auth.admin.getUserById(uid);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 });
    }

    const isValid = validateResetToken(uid, user.email || '', token);
    if (!isValid) {
      return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(uid, {
      password: password,
    });

    if (updateError) {

      return NextResponse.json({ error: 'Failed to update password.' }, { status: 500 });
    }


    return NextResponse.json({ success: true });
  } catch (err: any) {

    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
