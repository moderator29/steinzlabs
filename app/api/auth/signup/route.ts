import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const admin = getSupabaseAdmin();

    if (body.username && !body.email) {
      const cleanUsername = body.username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' }, { status: 400 });
      }
      const { data: existingProfile, error: profileError } = await admin
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();
      if (!profileError) {
        return NextResponse.json({ available: !existingProfile });
      }
      const { data: { users } } = await admin.auth.admin.listUsers();
      const taken = users?.some((u: any) => u.user_metadata?.username?.toLowerCase() === cleanUsername);
      return NextResponse.json({ available: !taken });
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

    const { data: emailProfile } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle();
    if (emailProfile) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
    }

    const { data: usernameProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();
    if (usernameProfile) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
    }

    let page = 0;
    const perPage = 100;
    let emailExists = false;
    let usernameTaken = false;
    while (true) {
      const { data: usersData } = await admin.auth.admin.listUsers({ page: page + 1, perPage });
      if (!usersData?.users || usersData.users.length === 0) break;
      if (usersData.users.some((u: any) => u.email?.toLowerCase() === cleanEmail)) emailExists = true;
      if (usersData.users.some((u: any) => u.user_metadata?.username?.toLowerCase() === cleanUsername)) usernameTaken = true;
      if (emailExists || usernameTaken) break;
      if (usersData.users.length < perPage) break;
      page++;
      if (page > 10) break;
    }
    if (emailExists) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
    }
    if (usernameTaken) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
    }

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: false,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: cleanUsername,
      },
    });

    if (createError) {
      console.error('[Signup] createUser error:', createError.message);
      if (createError.message.toLowerCase().includes('already') || createError.message.toLowerCase().includes('exists') || createError.message.toLowerCase().includes('duplicate')) {
        return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
      }
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (!newUser?.user) {
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 });
    }

    try {
      await admin.from('profiles').upsert({
        id: newUser.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: cleanUsername,
        email: cleanEmail,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (profileErr: any) {
      console.error('[Signup] Profile upsert error:', profileErr?.message);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'signup',
      email: cleanEmail,
      password: password,
      options: {
        redirectTo: 'https://steinzlabs.com/auth/callback',
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[Signup] generateLink error:', linkError?.message);
      await admin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: 'Failed to generate verification link. Please try again.' }, { status: 500 });
    }

    let confirmUrl = linkData.properties.action_link;
    confirmUrl = confirmUrl.replace(/redirect_to=http[^&]*/g, 'redirect_to=https://steinzlabs.com/auth/callback');
    confirmUrl = confirmUrl.replace('http://localhost:3000', 'https://steinzlabs.com');
    confirmUrl = confirmUrl.replace('http://localhost:5000', 'https://steinzlabs.com');

    const emailSent = await sendVerificationEmail(cleanEmail, confirmUrl, firstName.trim());

    if (!emailSent) {
      console.error('[Signup] Email send failed, deleting user and asking to retry');
      await admin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 });
    }

    console.log(`[Signup] Verification email sent to ${cleanEmail}`);
    return NextResponse.json({ success: true, email: cleanEmail, needsConfirmation: true });

  } catch (err: any) {
    console.error('[Signup] error:', err.message);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
