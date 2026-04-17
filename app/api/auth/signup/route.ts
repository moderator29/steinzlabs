import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendVerificationEmail } from '@/lib/email';
import { generateVerifyToken } from '@/lib/authTokens';
import { getSiteUrl } from '@/lib/siteUrl';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.username && !body.email) {
      const cleanUsername = body.username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' }, { status: 400 });
      }
      try {
        const admin = getSupabaseAdmin();
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
      } catch (adminErr: any) {

        // Return unknown so frontend doesn't falsely show "username taken"
        return NextResponse.json({ available: null, error: 'service_unavailable' }, { status: 503 });
      }
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
    try {
      admin = getSupabaseAdmin();
    } catch (e: any) {

      return NextResponse.json({ error: 'Server configuration error. Please contact support.' }, { status: 503 });
    }

    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const allUsers = existingUsers?.users || [];
    const emailExists = allUsers.some(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );
    if (emailExists) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in.' }, { status: 400 });
    }
    const usernameTaken = allUsers.some(
      (u: any) => u.user_metadata?.username?.toLowerCase() === cleanUsername
    );
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

    }

    const token = await generateVerifyToken(newUser.user.id, cleanEmail);
    const confirmUrl = `${getSiteUrl()}/api/auth/verify-email?token=${token}&uid=${newUser.user.id}`;

    const emailSent = await sendVerificationEmail(cleanEmail, confirmUrl, firstName.trim());

    if (!emailSent) {

      await admin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 });
    }


    return NextResponse.json({ success: true, email: cleanEmail, needsConfirmation: true });

  } catch (err: any) {

    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
