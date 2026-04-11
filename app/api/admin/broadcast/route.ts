import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const ADMIN_PASSWORD = '195656';

export async function POST(request: Request) {
  try {
    const { password, subject, body, targetTier } = await request.json();

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!subject || !body) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase.from('profiles').select('email, first_name, username');
    if (targetTier && targetTier !== 'all') {
      query = query.eq('tier', targetTier);
    }

    const { data: users, error } = await query;

    if (error) {

      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const emails = (users || [])
      .map((u: any) => u.email)
      .filter((e: string) => e && e.includes('@'));

    if (emails.length === 0) {
      return NextResponse.json({ error: 'No eligible recipients found' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    let sent = 0;
    let failed = 0;
    const batchSize = 10;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const promises = batch.map(async (email: string) => {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'STEINZ LABS <noreply@steinzlabs.com>',
              to: email,
              subject,
              html: `
                <div style="background:#0A0E1A;color:#fff;padding:40px 20px;font-family:system-ui,-apple-system,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="text-align:center;margin-bottom:30px;">
                      <h1 style="color:#0A1EFF;margin:0;font-size:24px;">STEINZ LABS</h1>
                      <p style="color:#6B7280;font-size:12px;margin-top:4px;">On-chain Intelligence Platform</p>
                    </div>
                    <div style="background:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:24px;">
                      <h2 style="color:#fff;margin:0 0 16px;font-size:18px;">${subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2>
                      <div style="color:#D1D5DB;font-size:14px;line-height:1.6;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</div>
                    </div>
                    <p style="color:#4B5563;font-size:11px;text-align:center;margin-top:24px;">
                      STEINZ LABS. The intelligence layer for on-chain alpha.
                    </p>
                  </div>
                </div>
              `,
            }),
          });

          if (res.ok) {
            sent++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      });

      await Promise.all(promises);
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: emails.length,
      message: `Broadcast sent to ${sent} of ${emails.length} users`,
    });
  } catch (error) {

    return NextResponse.json({ error: 'Broadcast failed' }, { status: 500 });
  }
}
