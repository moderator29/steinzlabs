import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Email/username and password are required' }, { status: 400 });
    }

    let email = identifier;

    const isEmail = identifier.includes('@');
    if (!isEmail) {
      const adminClient = getSupabaseAdmin();
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email')
        .eq('username', identifier.toLowerCase())
        .single();

      if (!profile?.email) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }
      email = profile.email;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const serverSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await serverSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: 'Invalid email/username or password' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
