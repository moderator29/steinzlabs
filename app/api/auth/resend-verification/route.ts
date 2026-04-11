import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendVerificationEmail } from '@/lib/email';
import { generateVerifyToken } from '@/lib/authTokens';
import { getSiteUrl } from '@/lib/siteUrl';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const admin = getSupabaseAdmin();

    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = usersData?.users?.find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    if (!user) {
      return NextResponse.json({ error: 'No account found with that email.' }, { status: 404 });
    }

    if (user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email is already verified. You can sign in.' }, { status: 400 });
    }

    const token = generateVerifyToken(user.id, cleanEmail);
    const confirmUrl = `${getSiteUrl()}/api/auth/verify-email?token=${token}&uid=${user.id}`;

    const firstName = user.user_metadata?.first_name || 'there';
    const emailSent = await sendVerificationEmail(cleanEmail, confirmUrl, firstName);

    if (!emailSent) {
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }


    return NextResponse.json({ success: true });
  } catch (err: any) {

    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
