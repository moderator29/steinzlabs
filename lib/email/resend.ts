import 'server-only';

/**
 * §3 P2-F.9 — Resend client. Resend is the chosen email provider
 * (vs Postmark) for its first-class Next.js DX, React Email
 * integration, and free tier sufficient for our digest volume. The
 * env var name is RESEND_API_KEY (set in Vercel).
 *
 * If the key is missing, sendEmail() falls open (returns
 * { ok: false, reason: 'unconfigured' }) — never throws. Production
 * digests + verification emails check the return value.
 */

const RESEND_API = 'https://api.resend.com/emails';

export interface SendEmailParams {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  reply_to?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  status?: number;
  reason?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: 'unconfigured' };

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.reply_to,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, reason: `resend ${res.status}` };
    }
    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id, status: res.status };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'send failed' };
  }
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
