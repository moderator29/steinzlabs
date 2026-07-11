import 'server-only';

const RESEND_API_URL = 'https://api.resend.com/emails';

function getResendKey(): string {
  return (process.env.RESEND_API_KEY || '').trim();
}

function resolveAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz').replace(/\/$/, '');
}

/**
 * Shared branded shell — the clean, high-contrast near-black glass system that
 * matches the redesigned whale-alert email in lib/services/resend.ts. Every
 * transactional/alert email renders through this so they read as one premium
 * family: a near-black (#05070f) canvas, a single glass card
 * (linear-gradient(160deg,#0d1120,#070a12) with a hairline white border), the
 * logo avatar in the header, white/high-contrast type, and a muted footer.
 * Accents (blue #0066FF, emerald #10B981) are applied by the bodies, sparingly.
 */
export function brandedEmailWrapper(title: string, subtitle: string, bodyHtml: string): string {
  const APP_URL = resolveAppUrl();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#05070f;font-family:'Segoe UI',Roboto,Helvetica,Arial,-apple-system,BlinkMacSystemFont,sans-serif;">
  <div style="background:#05070f;padding:28px 12px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:linear-gradient(160deg,#0d1120,#070a12);border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.55)">
        <tr>
          <td style="padding:34px 30px 22px;text-align:center;">
            <img src="${APP_URL}/logo.png" width="52" height="52" alt="NAKA LABS" style="width:52px;height:52px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);background:#0b0f1c;display:inline-block;" />
            <h1 style="margin:18px 0 6px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;line-height:1.25;">${title}</h1>
            <p style="margin:0;font-size:13.5px;color:#8a93a8;line-height:1.5;">${subtitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 30px 30px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 30px;border-top:1px solid rgba(255,255,255,0.07);background:rgba(0,0,0,0.25);text-align:center;">
            <p style="margin:0;font-size:11px;color:#7c869c;line-height:1.6;">&copy; 2026 NAKA LABS. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr></table>
  </div>
</body>
</html>`;
}

/**
 * The single gradient CTA every branded email is allowed (brand rule: one
 * gradient CTA). Full-width, high-contrast, brand-blue gradient.
 */
export function emailButton(href: string, label: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">
      <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#0066FF,#0047C2);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:15px 44px;border-radius:12px;letter-spacing:0.2px;">${label}</a>
    </td></tr></table>`;
}

// Sender comes from EMAIL_FROM env when set (e.g.
// "NAKA LABS <noreply@contact.nakalabs.xyz>"), falls back to the
// Resend-verified contact.nakalabs.xyz subdomain. The previous
// hardcoded noreply@nakalabs.xyz was on an unverified domain and
// caused Resend to reject every send.
const DEFAULT_FROM = 'NAKA LABS <noreply@contact.nakalabs.xyz>';

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = getResendKey();
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY not set');
    return false;
  }

  const from = (process.env.EMAIL_FROM || '').trim() || DEFAULT_FROM;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend ${res.status}: ${body}`);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[email] send threw:', err?.message || err);
    return false;
  }
}

export async function sendVerificationEmail(
  to: string,
  confirmUrl: string,
  firstName: string
): Promise<boolean> {
  const body = `
    <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#dfe4ee;">Click the button below to verify your email address and activate your NAKA LABS account.</p>
    ${emailButton(confirmUrl, 'Verify email')}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a93a8;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:#4d94ff;word-break:break-all;">${confirmUrl}</p>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#7c869c;">If you didn't create a NAKA LABS account, you can safely ignore this email.</p>`;

  const html = brandedEmailWrapper('Verify your email', `Welcome to NAKA LABS, ${firstName}`, body);
  return sendEmail(to, 'Verify your NAKA LABS account', html);
}

export async function sendWelcomeEmail(
  to: string,
  firstName: string
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz';
  const body = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#dfe4ee;">Hi ${firstName},</p>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#dfe4ee;">Welcome to NAKA LABS. You're now set up on the on-chain intelligence platform built for traders who want edge without noise.</p>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:18px 20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#10B981;">Your first 5 minutes</p>
      <ul style="margin:0;padding-left:18px;color:#dfe4ee;font-size:13px;line-height:1.75;">
        <li>Open the <a href="${appUrl}/dashboard" style="color:#4d94ff;text-decoration:none;">Dashboard</a> to see the live Context Feed</li>
        <li>Paste any token address into the Security Center for an instant Trust Score</li>
        <li>Check the <a href="${appUrl}/dashboard/whale-tracker" style="color:#4d94ff;text-decoration:none;">Whale Tracker</a> and follow wallets that matter</li>
        <li>Set up alerts so you get pinged on the moves you actually care about</li>
      </ul>
    </div>

    ${emailButton(`${appUrl}/dashboard`, 'Open your dashboard')}

    <p style="margin:28px 0 8px;font-size:13px;font-weight:700;color:#ffffff;">Your Naka Wallet</p>
    <p style="margin:0 0 16px;font-size:12px;line-height:1.65;color:#8a93a8;">Naka ships a fully non-custodial wallet. Your keys are encrypted on your device and never leave unencrypted. Always back up your seed phrase before funding the wallet. External wallets (MetaMask, Phantom, Coinbase Wallet) also connect.</p>

    <p style="margin:0;font-size:12px;line-height:1.5;color:#7c869c;">Questions? Reply to this email or ping us in the app via the VTX assistant.</p>`;

  const html = brandedEmailWrapper('Welcome aboard', `${firstName}, let's get you running`, body);
  return sendEmail(to, 'Welcome to NAKA LABS', html);
}

export async function sendAlertDigestEmail(
  to: string,
  firstName: string | null,
  alerts: Array<{ name: string | null; type: string | null; triggered_at: string }>,
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz';
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const top = alerts.slice(0, 10);
  const rows = top
    .map((a) => {
      const when = new Date(a.triggered_at).toLocaleString();
      const name = escape(a.name ?? 'Alert');
      const type = escape(a.type ?? 'generic');
      return `<tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);"><strong style="color:#ffffff;font-size:14px;">${name}</strong> <span style="color:#8a93a8;font-size:13px;">(${type})</span><br/><span style="color:#7c869c;font-size:11px;">${escape(when)}</span></td></tr>`;
    })
    .join('');
  const extra =
    alerts.length > top.length
      ? `<p style="margin:14px 0 0;font-size:12px;color:#8a93a8;">…and ${alerts.length - top.length} more.</p>`
      : '';
  const hi = firstName ? `Hi ${escape(firstName)},` : 'Hi,';
  const body = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#dfe4ee;">${hi}</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#dfe4ee;"><strong style="color:#ffffff;">${alerts.length}</strong> alert${alerts.length === 1 ? '' : 's'} fired in the last 4 hours.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">${rows}</table>
    ${extra}
    ${emailButton(`${appUrl}/dashboard/alerts`, 'Open alerts')}
    <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#7c869c;">Tune cadence or pause email digests in your <a href="${appUrl}/dashboard/settings" style="color:#4d94ff;text-decoration:none;">notification settings</a>.</p>`;
  const html = brandedEmailWrapper('Alert digest', 'Last 4 hours', body);
  return sendEmail(to, `Naka digest: ${alerts.length} alert${alerts.length === 1 ? '' : 's'}`, html);
}

export async function sendNewsDigestEmail(
  to: string,
  firstName: string | null,
  items: Array<{ title: string; url: string; source: string; summary?: string }>,
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz';
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const top = items.slice(0, 6);
  const rows = top
    .map((it) => {
      const title = escape(it.title);
      const src = escape(it.source);
      const summary = it.summary ? escape(it.summary.slice(0, 140)) : '';
      const url = escape(it.url);
      return `<tr><td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
        <a href="${url}" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1.45;">${title}</a>
        ${summary ? `<br/><span style="color:#c3cad8;font-size:12px;line-height:1.55;">${summary}</span>` : ''}
        <br/><span style="color:#7c869c;font-size:11px;">${src}</span>
      </td></tr>`;
    })
    .join('');
  const hi = firstName ? `Hi ${escape(firstName)},` : 'Hi,';
  const body = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#dfe4ee;">${hi}</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#dfe4ee;">Today's top crypto headlines from across the wire.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">${rows}</table>
    ${emailButton(`${appUrl}/dashboard`, 'Open the News feed')}
    <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#7c869c;">You opted in to news email. Turn it off anytime in your <a href="${appUrl}/dashboard/settings" style="color:#4d94ff;text-decoration:none;">notification settings</a>.</p>`;
  const html = brandedEmailWrapper('Crypto news digest', 'Top headlines', body);
  return sendEmail(to, `Naka Labs: ${top.length} top crypto headline${top.length === 1 ? '' : 's'}`, html);
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  firstName: string
): Promise<boolean> {
  const body = `
    <p style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#dfe4ee;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#dfe4ee;">We received a request to reset your password. Click the button below to create a new password.</p>
    ${emailButton(resetUrl, 'Reset password')}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a93a8;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:#4d94ff;word-break:break-all;">${resetUrl}</p>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#7c869c;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>`;

  const html = brandedEmailWrapper('Reset your password', 'NAKA LABS Account Recovery', body);
  return sendEmail(to, 'Reset your NAKA LABS password', html);
}
