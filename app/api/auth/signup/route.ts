import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        joined_at: new Date().toISOString(),
      }
    });

    if (createError) {
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 409 });
      }
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: createData.user.id,
        email: createData.user.email,
      },
      message: 'Account created successfully. You can now sign in.'
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
