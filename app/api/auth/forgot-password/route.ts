import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPasswordResetEmail } from '@/lib/email';
import { generateResetToken } from '@/lib/authTokens';
import { getSiteUrl } from '@/lib/siteUrl';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // 3 reset-email requests per IP per hour. Stops email-enumeration probes
    // and protects the SendGrid quota.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = rateLimit(`auth:forgot:${ip}`, { interval: 3_600_000, maxRequests: 3 });
    if (!rl.success) return rateLimitResponse(rl);

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

    const token = await generateResetToken(user.id, cleanEmail);
    const resetUrl = `${getSiteUrl()}/reset-password?token=${token}&uid=${user.id}`;

    const firstName = user.user_metadata?.first_name || 'there';
    const emailSent = await sendPasswordResetEmail(cleanEmail, resetUrl, firstName);

    if (!emailSent) {

      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }


    return NextResponse.json({ success: true });
  } catch (err: any) {

    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
