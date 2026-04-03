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

function getServiceKey(): string {
  return (process.env.SUPABASE_SERVICE_KEY || '').trim().replace(/^["']+|["']+$/g, '');
}

function getAdminClient() {
  const serviceKey = getServiceKey();
  if (!serviceKey) return null;
  try {
    const client = createClient(getUrl(), serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return client;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const anonKey = getAnonKey();

    if (!anonKey || anonKey.length < 20) {
      console.error('[Signup] Anon key not available');
      return NextResponse.json({ error: 'Auth service not configured.' }, { status: 500 });
    }

    if (body.username && !body.email) {
      return NextResponse.json({ available: true });
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

    if (admin) {
      try {
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email: cleanEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            username: cleanUsername,
          },
        });

        if (createError) {
          if (createError.message.toLowerCase().includes('already') || createError.message.toLowerCase().includes('exists') || createError.message.toLowerCase().includes('duplicate')) {
            return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
          }
          console.warn('[Signup] Admin createUser failed, falling back to signUp:', createError.message);
        } else if (newUser?.user) {
          try {
            await admin.from('profiles').upsert({
              id: newUser.user.id,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              username: cleanUsername,
              email: cleanEmail,
              created_at: new Date().toISOString(),
            }, { onConflict: 'id' });
          } catch {}
          return NextResponse.json({ success: true, email: cleanEmail });
        }
      } catch (adminErr: any) {
        console.warn('[Signup] Admin API unavailable:', adminErr.message);
      }
    }

    const supabase = createClient(getUrl(), anonKey, {
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
      },
    });

    if (signUpError) {
      console.error('[Signup] signUp error:', signUpError.message);
      if (signUpError.message.toLowerCase().includes('already') || signUpError.message.toLowerCase().includes('exists')) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
      }
      if (signUpError.message.toLowerCase().includes('rate') || signUpError.message.toLowerCase().includes('limit')) {
        return NextResponse.json({ error: 'Too many signup attempts. Please wait a moment.' }, { status: 429 });
      }
      if (signUpError.message.toLowerCase().includes('email') && signUpError.message.toLowerCase().includes('confirm')) {
        return NextResponse.json({ success: true, email: cleanEmail, needsConfirmation: true });
      }
      return NextResponse.json({ error: signUpError.message }, { status: 500 });
    }

    if (!signUpData?.user || signUpData.user.identities?.length === 0) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, email: cleanEmail, needsConfirmation: !signUpData.session });

  } catch (err: any) {
    console.error('[Signup] error:', err.message);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
