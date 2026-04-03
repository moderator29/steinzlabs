import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://phvewrldcdxupsnakddx.supabase.co';

function getUrl(): string {
  const env = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/^["']+|["']+$/g, '');
  return (env && env.startsWith('https://')) ? env : SUPABASE_URL;
}

function getAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim().replace(/^["']+|["']+$/g, '');
}

function getAdminClient() {
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim().replace(/^["']+|["']+$/g, '');
  if (!serviceKey) return null;
  try {
    return createClient(getUrl(), serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.username && !body.email) {
      const cleanUsername = body.username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' }, { status: 400 });
      }
      const admin = getAdminClient();
      if (!admin) return NextResponse.json({ available: true });
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

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Auth service not configured.' }, { status: 500 });
    }

    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );
    if (emailExists) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
    }

    const metadata = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: cleanUsername,
    };

    const anonKey = getAnonKey();
    let needsConfirmation = false;
    let userId: string | null = null;

    if (anonKey && anonKey.length > 20) {
      const supabase = createClient(getUrl(), anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: { data: metadata },
      });

      if (!signUpError && signUpData?.user && signUpData.user.identities?.length !== 0) {
        userId = signUpData.user.id;
        needsConfirmation = true;
      } else if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes('already') || msg.includes('exists')) {
          return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
        }
        if (msg.includes('rate') || msg.includes('limit')) {
          return NextResponse.json({ error: 'Too many signup attempts. Please wait a moment.' }, { status: 429 });
        }
        console.warn('[Signup] signUp failed, falling back to admin:', signUpError.message);
      }
    }

    if (!userId) {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (createError) {
        if (createError.message.toLowerCase().includes('already') || createError.message.toLowerCase().includes('exists') || createError.message.toLowerCase().includes('duplicate')) {
          return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
        }
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      userId = newUser?.user?.id || null;
      needsConfirmation = false;
    }

    if (userId) {
      try {
        await admin.from('profiles').upsert({
          id: userId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: cleanUsername,
          email: cleanEmail,
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      needsConfirmation,
    });

  } catch (err: any) {
    console.error('[Signup] error:', err.message);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
