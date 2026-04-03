import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName, username } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch (e: any) {
      console.error('Admin client init failed:', e.message);
      return NextResponse.json({ error: 'Server configuration error. Please try again later.' }, { status: 500 });
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: false,
      user_metadata: {
        first_name: firstName?.trim() || '',
        last_name: lastName?.trim() || '',
        username: cleanUsername,
      },
    });

    if (createError || !newUser?.user) {
      if (createError?.message?.includes('already been registered') || createError?.message?.includes('already exists')) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 409 });
      }
      console.error('Signup error:', createError?.message);
      return NextResponse.json({ error: createError?.message || 'Failed to create account' }, { status: 500 });
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: newUser.user.id,
      first_name: firstName?.trim() || '',
      last_name: lastName?.trim() || '',
      username: cleanUsername,
      email: cleanEmail,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      if (profileError.message?.includes('duplicate') || profileError.code === '23505') {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
      }
      console.error('Profile error:', profileError.message);
    }

    let emailSent = false;
    try {
      const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: cleanEmail,
        password,
      });
      if (!linkError) {
        emailSent = true;
      } else {
        console.error('Generate link error:', linkError.message);
      }
    } catch (e: any) {
      console.error('Generate link exception:', e.message);
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      emailSent,
      requiresConfirmation: true,
    });

  } catch (err: any) {
    console.error('Signup error:', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
