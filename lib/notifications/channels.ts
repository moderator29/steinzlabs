import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email/resend';

/**
 * §3 P2-F.6 + P2-F.7 — multi-channel notification fan-out. Looks up a
 * user's enabled channels and dispatches the alert payload to each.
 * Channels: in-app (Supabase notifications table), Discord webhook,
 * Twilio SMS, Resend email. Telegram is handled by the existing
 * telegram-heartbeat path.
 */

interface FanOutPayload {
  user_id: string;
  title: string;
  message: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

interface ChannelRow {
  discord_webhook: string | null;
  sms_phone: string | null;
  sms_enabled: boolean;
  discord_enabled: boolean;
}

async function sendDiscord(webhook: string, payload: FanOutPayload): Promise<boolean> {
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'NakaLabs',
        embeds: [{
          title: payload.title,
          description: payload.message,
          color: 0x0a1eff,
          timestamp: new Date().toISOString(),
        }],
      }),
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendTwilioSMS(phone: string, message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return false;
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: phone,
        Body: message.slice(0, 1500),     // SMS hard cap
      }).toString(),
      signal: AbortSignal.timeout(6_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fans out a notification to every channel the user has enabled. Always
 * writes the in-app notifications row first so it's durable; external
 * channels are best-effort.
 */
export async function fanOutNotification(payload: FanOutPayload): Promise<{
  inApp: boolean;
  discord: boolean | null;
  sms: boolean | null;
  email: boolean | null;
}> {
  const admin = getSupabaseAdmin();

  // Always log the in-app row — it's the durable surface for the bell.
  const { error: inAppErr } = await admin.from('notifications').insert({
    user_id: payload.user_id,
    type: payload.type ?? 'alert',
    title: payload.title,
    message: payload.message,
    metadata: payload.metadata ?? {},
    read: false,
  });
  const inApp = !inAppErr;

  // Resolve per-user channel prefs.
  const { data: channels } = await admin
    .from('user_notification_channels')
    .select('discord_webhook, sms_phone, sms_enabled, discord_enabled')
    .eq('user_id', payload.user_id)
    .maybeSingle<ChannelRow>();

  // Email is governed by user_settings.email_alerts_enabled (existing).
  const { data: profile } = await admin
    .from('profiles')
    .select('email, settings')
    .eq('id', payload.user_id)
    .maybeSingle<{ email: string | null; settings: Record<string, unknown> | null }>();

  const emailEnabled = profile?.email && (profile.settings as { email_alerts_enabled?: boolean } | null)?.email_alerts_enabled !== false;

  // External fans-out in parallel — none blocks the others; results
  // recorded so callers can surface per-channel status.
  const [discordOk, smsOk, emailOk] = await Promise.all([
    channels?.discord_enabled && channels.discord_webhook
      ? sendDiscord(channels.discord_webhook, payload)
      : Promise.resolve(null as boolean | null),
    channels?.sms_enabled && channels.sms_phone
      ? sendTwilioSMS(channels.sms_phone, `${payload.title}: ${payload.message}`)
      : Promise.resolve(null as boolean | null),
    emailEnabled && profile?.email
      ? sendEmail({
          to: profile.email,
          from: process.env.RESEND_FROM_EMAIL ?? 'alerts@nakalabs.xyz',
          subject: payload.title,
          html: `<p>${payload.message}</p><p style="color:#94a3b8;font-size:12px;">NakaLabs · <a href="https://nakalabs.xyz">nakalabs.xyz</a></p>`,
        }).then((r) => r.ok)
      : Promise.resolve(null as boolean | null),
  ]);

  return { inApp, discord: discordOk, sms: smsOk, email: emailOk };
}
