import 'server-only';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { logAdminAction } from '@/lib/admin/auditLog';

const FROM_ADDRESS = 'Naka Labs <hello@nakalabs.xyz>';
const BATCH_SIZE = 50;

type Audience = 'all' | 'pro' | 'free';

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const body = await request.json() as {
      subject?: string;
      html?: string;
      audience?: Audience;
    };

    const { subject, html, audience } = body;

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    if (!html || typeof html !== 'string' || !html.trim()) {
      return NextResponse.json({ error: 'HTML body is required' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();

    // Emails live in auth.users (profiles has NO email column — the previous
    // profiles.select('email') 500'd). Select matching profile IDs by tier,
    // then resolve emails from the auth admin API.
    let profQuery = supabase.from('profiles').select('id');
    if (audience === 'pro' || audience === 'free') {
      profQuery = profQuery.eq('tier', audience);
    }
    const { data: profRows, error: queryError } = await profQuery;
    if (queryError) {
      console.error('[admin/newsletter] Profile query failed:', queryError);
      Sentry.captureException(queryError);
      return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
    }
    const targetIds = new Set((profRows ?? []).map((p: { id: string }) => p.id));

    const recipients: string[] = [];
    const PAGE = 1000;
    for (let page = 1; page <= 50; page++) {
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: PAGE });
      if (listErr) break;
      const batch = list?.users ?? [];
      for (const u of batch) {
        if (u.email && u.email.includes('@') && !u.email.endsWith('@wallet.nakalabs.com') && targetIds.has(u.id)) {
          recipients.push(u.email);
        }
      }
      if (batch.length < PAGE) break;
    }

    if (recipients.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, message: 'No eligible recipients' });
    }

    const resend = new Resend(resendKey);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((to) =>
          resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject,
            html,
          })
        )
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && !result.value.error) {
          sent++;
        } else {
          failed++;
          if (result.status === 'rejected') {
            console.error('[admin/newsletter] Send rejected:', result.reason);
            Sentry.captureException(result.reason);
          } else if (result.value.error) {
            console.error('[admin/newsletter] Send error:', result.value.error);
          }
        }
      }
    }

    void logAdminAction({
      adminId,
      action: 'newsletter_send',
      details: { subject, audience: audience ?? 'all', recipients: recipients.length, sent, failed },
    });
    return NextResponse.json({ sent, failed });
  } catch (err) {
    console.error('[admin/newsletter] failed:', err);
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Newsletter send failed' }, { status: 500 });
  }
}
