import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPasswordResetEmail } from '@/lib/email';
import { generateResetToken } from '@/lib/authTokens';
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
      return NextResponse.json({ success: true });
    }

    const token = generateResetToken(user.id, cleanEmail);
    const resetUrl = `${getSiteUrl()}/reset-password?token=${token}&uid=${user.id}`;

    const firstName = user.user_metadata?.first_name || 'there';
    const emailSent = await sendPasswordResetEmail(cleanEmail, resetUrl, firstName);

    if (!emailSent) {
      console.error('[ForgotPassword] Failed to send reset email to', cleanEmail);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    console.log(`[ForgotPassword] Reset email sent to ${cleanEmail}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[ForgotPassword] error:', err.message);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
