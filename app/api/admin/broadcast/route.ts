import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { logAdminAction } from '@/lib/admin/auditLog';

const BroadcastBody = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  targetTier: z.enum(['all', 'free', 'pro', 'inactive']).default('all').optional(),
});

// 30 days with no profile update = "inactive" for broadcast targeting.
const INACTIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const raw = await request.json().catch(() => null);
    const parsed = BroadcastBody.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.issues }, { status: 400 });
    }
    const { subject, body, targetTier } = parsed.data;

    const supabase = getSupabaseAdmin();

    // Audience selection. Emails live in auth.users (profiles has NO email
    // column — the previous profiles.select('email') 500'd, so broadcast never
    // sent). Select the matching profile IDs by tier/activity, then resolve
    // their emails from the auth admin API.
    //   free     → free tier (incl. NULL tier)
    //   pro      → any paid tier (mini / pro / max)
    //   inactive → no profile activity in 30 days
    //   all      → every profile
    let profQuery = supabase.from('profiles').select('id');
    if (targetTier === 'free') {
      profQuery = profQuery.or('tier.eq.free,tier.is.null');
    } else if (targetTier === 'pro') {
      profQuery = profQuery.in('tier', ['mini', 'pro', 'max']);
    } else if (targetTier === 'inactive') {
      profQuery = profQuery.lt('updated_at', new Date(Date.now() - INACTIVE_AFTER_MS).toISOString());
    }

    const { data: profRows, error } = await profQuery;
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch audience' }, { status: 500 });
    }
    const targetIds = new Set((profRows ?? []).map((p: { id: string }) => p.id));

    // Resolve emails from auth.users (paginated). Skip synthesized wallet-auth
    // addresses (@wallet.nakalabs.xyz, and legacy @wallet.nakalabs.com) —
    // those mailboxes don't exist.
    const emails: string[] = [];
    const PAGE = 1000;
    for (let page = 1; page <= 50; page++) {
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: PAGE });
      if (listErr) break;
      const batch = list?.users ?? [];
      for (const u of batch) {
        if (u.email && u.email.includes('@') && !u.email.includes('@wallet.nakalabs.') && targetIds.has(u.id)) {
          emails.push(u.email);
        }
      }
      if (batch.length < PAGE) break;
    }

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
              from: 'NAKA LABS <noreply@nakalabs.xyz>',
              to: email,
              subject,
              html: `
                <div style="background:#0A0E1A;color:#fff;padding:40px 20px;font-family:system-ui,-apple-system,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="text-align:center;margin-bottom:30px;">
                      <h1 style="color:#0066FF;margin:0;font-size:24px;">NAKA LABS</h1>
                      <p style="color:#6B7280;font-size:12px;margin-top:4px;">On-chain Intelligence Platform</p>
                    </div>
                    <div style="background:#111827;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:24px;">
                      <h2 style="color:#fff;margin:0 0 16px;font-size:18px;">${subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2>
                      <div style="color:#D1D5DB;font-size:14px;line-height:1.6;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</div>
                    </div>
                    <p style="color:#4B5563;font-size:11px;text-align:center;margin-top:24px;">
                      NAKA LABS. The intelligence layer for on-chain alpha.
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

    void logAdminAction({
      adminId,
      action: 'broadcast_send',
      details: { subject, targetTier: targetTier ?? 'all', sent, failed, total: emails.length },
    });
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
