import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §3 P2-F.6 + P2-F.7 — manage per-user notification channels
 * (Discord webhook + Twilio SMS phone). Telegram + in-app + email
 * are controlled by existing settings paths.
 *
 * GET  → { discord_webhook, sms_phone, sms_enabled, discord_enabled }
 * PUT  body { discord_webhook?, sms_phone?, sms_enabled?, discord_enabled? }
 *
 * SMS is gated to tier >= Pro (matches §3 P2-F.7). Discord is free
 * across tiers — webhook posts cost us nothing.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

export async function GET() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await sb
    .from('user_notification_channels')
    .select('discord_webhook, sms_phone, sms_enabled, discord_enabled, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json(data ?? {
    discord_webhook: null,
    sms_phone: null,
    sms_enabled: false,
    discord_enabled: false,
  });
}

export async function PUT(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    discord_webhook?: string | null;
    sms_phone?: string | null;
    sms_enabled?: boolean;
    discord_enabled?: boolean;
  };

  // Validate Discord webhook URL.
  if (body.discord_webhook && !/^https:\/\/discord(?:app)?\.com\/api\/webhooks\//.test(body.discord_webhook)) {
    return NextResponse.json({ error: 'discord_webhook must be a Discord webhook URL' }, { status: 400 });
  }
  // Validate E.164 phone.
  if (body.sms_phone && !/^\+[1-9]\d{6,14}$/.test(body.sms_phone)) {
    return NextResponse.json({ error: 'sms_phone must be E.164 format (+15551234567)' }, { status: 400 });
  }

  // SMS gating: Pro+ only.
  if (body.sms_enabled) {
    const { data: profile } = await sb
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .maybeSingle<{ settings: Record<string, unknown> | null }>();
    const tier = ((profile?.settings as { subscription_tier?: string } | null)?.subscription_tier ?? 'free').toLowerCase();
    if (tier === 'free') {
      return NextResponse.json({ error: 'SMS alerts require Pro tier or higher' }, { status: 403 });
    }
  }

  const admin = getSupabaseAdmin();
  const upsert: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  if (body.discord_webhook !== undefined) upsert.discord_webhook = body.discord_webhook;
  if (body.sms_phone !== undefined) upsert.sms_phone = body.sms_phone;
  if (body.sms_enabled !== undefined) upsert.sms_enabled = body.sms_enabled;
  if (body.discord_enabled !== undefined) upsert.discord_enabled = body.discord_enabled;

  const { error } = await admin.from('user_notification_channels').upsert(upsert, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
