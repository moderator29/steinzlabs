import { NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getSupabaseAdmin } from '@/lib/supabase';

const FIREBASE_PROJECT_ID = 'stringent-mvp';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_account/v1/jwk/securetoken@system.gserviceaccount.com')
);

async function verifyFirebaseToken(idToken: string): Promise<{ email: string; name?: string; uid: string; emailVerified: boolean } | null> {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    if (!payload.sub || !payload.email) return null;
    if (typeof payload.email !== 'string') return null;

    return {
      email: payload.email as string,
      name: (payload.name as string) || '',
      uid: payload.sub,
      emailVerified: payload.email_verified === true,
    };
  } catch (err: any) {
    console.error('Firebase token verification failed:', err.message);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { idToken, provider, displayName } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    if (provider && !['google', 'apple'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const firebaseUser = await verifyFirebaseToken(idToken);
    if (!firebaseUser) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!firebaseUser.emailVerified) {
      return NextResponse.json({ error: 'Email not verified' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const email = firebaseUser.email.toLowerCase();
    const name = displayName || firebaseUser.name || '';
    const firstName = name.split(' ')[0] || '';
    const lastName = name.split(' ').slice(1).join(' ') || '';

    const { data: existingUserLookup } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    let userId: string;

    if (existingUserLookup?.id) {
      userId = existingUserLookup.id;
    } else {
      const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const oauthPassword = `oauth_${randomPart}`;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: oauthPassword,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          provider: provider || 'google',
          firebase_uid: firebaseUser.uid,
        },
      });

      if (createError || !newUser?.user) {
        if (createError?.message?.includes('already been registered')) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
          const found = listData?.users?.find(u => u.email?.toLowerCase() === email);
          if (found) {
            userId = found.id;
          } else {
            console.error('User exists but not found:', createError?.message);
            return NextResponse.json({ error: 'Account conflict. Try email/password login.' }, { status: 409 });
          }
        } else {
          console.error('Failed to create user:', createError?.message);
          return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
        }
      } else {
        userId = newUser.user.id;
      }

      const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user';
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', baseUsername)
        .maybeSingle();

      const finalUsername = existingProfile ? `${baseUsername}_${Date.now().toString(36).slice(-4)}` : baseUsername;

      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        username: finalUsername,
        email,
        created_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error('Profile creation failed:', profileError.message);
      }
    }

    const sessionPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUser(userId, {
      password: sessionPassword,
    });

    if (updateError) {
      console.error('Failed to set session password:', updateError.message);
      return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email,
      sessionKey: sessionPassword,
    });

  } catch (err: any) {
    console.error('Social login error:', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
