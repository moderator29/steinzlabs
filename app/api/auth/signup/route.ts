import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const SUPABASE_URL = 'https://phvewrldcdxupsnakddx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBodmV3cmxkY2R4dXBzbmFrZGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA0NjMsImV4cCI6MjA5MDc3NjQ2M30.xHGPMphDjMsPN566gRcGle5Mp8mEBxGiI1HXDX9M7ZU';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.username && !body.email) {
      const cleanUsername = body.username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' }, { status: 400 });
      }
      let admin;
      try { admin = getSupabaseAdmin(); } catch {
        return NextResponse.json({ available: true });
      }
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();
      return NextResponse.json({ available: !existingProfile });
    }

    const { email, password, firstName, lastName, username } = body;

    if (!email || !password || !firstName || !lastName || !username) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (password.length < 8 || password.length > 100) {
      return NextResponse.json({ error: 'Password must be between 8 and 100 characters' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' }, { status: 400 });
    }

    let admin;
    try { admin = getSupabaseAdmin(); } catch {}

    if (admin) {
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const emailExists = existingUsers?.users?.some(
        (u: any) => u.email?.toLowerCase() === cleanEmail
      );
      if (emailExists) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: cleanUsername,
        },
        emailRedirectTo: 'https://steinzlabs.com/login',
      },
    });

    if (signUpError) {
      console.error('[Signup] error:', signUpError.message);
      if (signUpError.message.toLowerCase().includes('already') || signUpError.message.toLowerCase().includes('exists')) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
      }
      if (signUpError.message.toLowerCase().includes('rate') || signUpError.message.toLowerCase().includes('limit')) {
        return NextResponse.json({ error: 'Too many signup attempts. Please wait a moment.' }, { status: 429 });
      }
      return NextResponse.json({ error: signUpError.message }, { status: 500 });
    }

    if (!signUpData?.user || signUpData.user.identities?.length === 0) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
    }

    if (admin && signUpData.user) {
      try {
        await admin.from('profiles').upsert({
          id: signUpData.user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: cleanUsername,
          email: cleanEmail,
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      } catch {}
    }

    return NextResponse.json({ success: true, email: cleanEmail, needsConfirmation: true });

  } catch (err: any) {
    console.error('[Signup] error:', err.message);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
