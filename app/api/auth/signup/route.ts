import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.username && !body.email) {
      const cleanUsername = body.username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' }, { status: 400 });
      }
      let supabaseAdmin;
      try {
        supabaseAdmin = getSupabaseAdmin();
      } catch {
        return NextResponse.json({ available: true });
      }
      const { data: existingProfile } = await supabaseAdmin
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

    const supabaseAdmin = getSupabaseAdmin();

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );
    if (emailExists) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
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
      console.error('Create user error:', createError.message);
      if (createError.message.includes('already')) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
      }
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (newUser?.user) {
      await supabaseAdmin.from('profiles').upsert({
        id: newUser.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: cleanUsername,
        email: cleanEmail,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }

    return NextResponse.json({ success: true, email: cleanEmail });

  } catch (err: any) {
    console.error('Signup error:', err.message);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
