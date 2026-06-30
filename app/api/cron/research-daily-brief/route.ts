import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildDailyBrief, buildDigestEmailHtml } from '@/lib/research/dailyBrief';
import { sendBatch } from '@/lib/services/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NAME = 'research-daily-brief';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz';

/**
 * research-daily-brief — once a day, assembles a real market brief (CoinGecko
 * movers + global vibe + the platform's own whale feed) and publishes it to
 * Research Labs as a styled post, then emails a rich preview digest to every
 * user who hasn't opted out of email. Idempotent: it publishes at most one
 * brief per UTC day, so a duplicate dispatch tick can't double post or
 * double send. Real data only; if every source is down it publishes nothing.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();

  try {
    const sb = getSupabaseAdmin();
    const now = new Date();
    const slug = `daily-market-brief-${now.toISOString().slice(0, 10)}`;

    // Idempotency — already published today?
    const { data: existing } = await sb
      .from('research_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing?.id) {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, skipped: 'already_published', id: existing.id });
    }

    const brief = await buildDailyBrief(now);
    if (!brief) {
      // No real data to report — do not publish an empty shell.
      await logCronExecution(NAME, 'success', Date.now() - startedAt, 'no_data', 0);
      return NextResponse.json({ ok: true, skipped: 'no_data' });
    }

    // Publish the post. Set both schema variants (summary/excerpt,
    // published/status, author, read_time) so every reader path renders it.
    const { data: post, error: insErr } = await sb
      .from('research_posts')
      .insert({
        slug: brief.slug,
        title: brief.title,
        summary: brief.summary,
        excerpt: brief.summary,
        content: brief.contentHtml,
        category: 'Daily Brief',
        image_url: brief.coverImage,
        cover_image: brief.coverImage,
        author: 'Naka Labs Research',
        status: 'published',
        published: true,
        tags: brief.tags,
        read_time: brief.readTime,
        published_at: now.toISOString(),
        created_at: now.toISOString(),
      })
      .select('id')
      .single();
    if (insErr || !post?.id) throw insErr ?? new Error('insert returned no id');

    const postUrl = `${APP_URL}/research/${post.id}`;

    // Email kill switch — set RESEARCH_DIGEST_EMAIL=false to publish the web
    // post only (e.g. a web-first rollout) without broadcasting to inboxes.
    if (process.env.RESEARCH_DIGEST_EMAIL === 'false') {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, id: post.id, slug: brief.slug, emailed: false, reason: 'email_disabled' });
    }

    // Build the recipient list: every auth user, minus those who set
    // email_enabled=false in notification_settings. Page through listUsers.
    const optedOut = new Set<string>();
    const { data: prefs } = await sb
      .from('notification_settings')
      .select('user_id, email_enabled')
      .eq('email_enabled', false);
    (prefs ?? []).forEach((p: { user_id: string }) => optedOut.add(p.user_id));

    const firstNameById = new Map<string, string | null>();
    const { data: profiles } = await sb.from('profiles').select('id, first_name');
    (profiles ?? []).forEach((p: { id: string; first_name: string | null }) => firstNameById.set(p.id, p.first_name));

    const recipients: Array<{ email: string; firstName: string | null }> = [];
    const seen = new Set<string>();
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const users = data?.users ?? [];
      if (users.length === 0) break;
      for (const u of users) {
        if (!u.email || optedOut.has(u.id) || seen.has(u.email)) continue;
        seen.add(u.email);
        recipients.push({ email: u.email, firstName: firstNameById.get(u.id) ?? null });
      }
      if (users.length < 200) break;
    }

    const subject = `${brief.vibe.emoji} Naka Daily Brief · ${brief.vibe.label} · ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
    const emails = recipients.map(r => ({
      to: r.email,
      subject,
      html: buildDigestEmailHtml(brief, postUrl, r.firstName),
    }));

    const { sent, failed } = await sendBatch(emails);

    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, sent);
    return NextResponse.json({ ok: true, id: post.id, slug: brief.slug, recipients: recipients.length, sent, failed });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
