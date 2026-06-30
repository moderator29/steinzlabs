import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildDailyBrief, buildDigestEmailHtml, briefEdition } from '@/lib/research/dailyBrief';
import { sendBatch } from '@/lib/services/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NAME = 'research-daily-brief';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz';

/**
 * research-daily-brief — runs every 12h (Morning 00:00 UTC / Evening 12:00 UTC)
 * via the twice-daily dispatch group. Assembles a real market brief (CoinGecko
 * movers + global vibe + the platform's own whale feed), publishes it to
 * Research Labs as a styled post, then emails a rich preview digest to every
 * user who hasn't opted out of email. Idempotent per edition: a duplicate
 * dispatch tick can't double post or double send the same edition. Real data
 * only; if every source is down it publishes nothing.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();

  try {
    const sb = getSupabaseAdmin();
    const now = new Date();
    // Two editions per UTC day (Morning 00:00 / Evening 12:00). The slug encodes
    // the edition so the 12h cadence yields two distinct posts.
    const slug = briefEdition(now).slug;

    // Idempotency — already published this edition?
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
    //
    // Atomic idempotency: upsert on the UNIQUE slug with ignoreDuplicates, so a
    // concurrent or retried daily dispatch tick that loses the race inserts
    // nothing and gets back an EMPTY result set (ON CONFLICT DO NOTHING returns
    // only rows this call actually wrote). We email ONLY when this call inserted
    // the row, so the entire userbase can never be re-blasted for the same day.
    const { data: insertedRows, error: insErr } = await sb
      .from('research_posts')
      .upsert({
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
      }, { onConflict: 'slug', ignoreDuplicates: true })
      .select('id');
    if (insErr) throw insErr;

    const postId = insertedRows && insertedRows.length > 0 ? insertedRows[0].id : null;
    if (!postId) {
      // Another tick already published today — do not re-publish or re-email.
      await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, skipped: 'already_published_race', slug: brief.slug });
    }

    const postUrl = `${APP_URL}/research/${postId}`;

    // Email kill switch — set RESEARCH_DIGEST_EMAIL=false to publish the web
    // post only (e.g. a web-first rollout) without broadcasting to inboxes.
    if (process.env.RESEARCH_DIGEST_EMAIL === 'false') {
      await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, id: postId, slug: brief.slug, emailed: false, reason: 'email_disabled' });
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
    return NextResponse.json({ ok: true, id: postId, slug: brief.slug, recipients: recipients.length, sent, failed });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
