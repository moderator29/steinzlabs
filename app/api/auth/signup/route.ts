import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName, username } = await request.json();

    if (!email || !password || !firstName || !lastName || !username) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();

    const { data: existingUser } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
    }

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        username: username.toLowerCase(),
      },
    });

    if (createError) {
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: createData.user.id,
      first_name: firstName,
      last_name: lastName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
