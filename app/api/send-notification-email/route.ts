import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

function buildEmailHtml(title: string, message: string, type: string): string {
  const typeColors: Record<string, string> = {
    whale_alert: '#0A1EFF',
    price_target: '#10B981',
    new_launch: '#7C3AED',
    wallet_activity: '#F59E0B',
    welcome: '#0A1EFF',
    wallet_created: '#10B981',
    system: '#6B7280',
  };
  const color = typeColors[type] || '#0A1EFF';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0A0E1A;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E1A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="padding:24px 32px;background:linear-gradient(135deg,${color}22,#7C3AED22);border-bottom:1px solid rgba(255,255,255,0.08);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">STEINZ LABS</span>
                    <span style="display:block;font-size:11px;color:#6B7280;margin-top:2px;letter-spacing:2px;text-transform:uppercase;">Crypto Intelligence Platform</span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:4px 12px;background:${color}33;border:1px solid ${color}66;border-radius:20px;font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px;">${type.replace(/_/g, ' ')}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#FFFFFF;line-height:1.3;">${title}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#9CA3AF;line-height:1.6;">${message}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="https://steinzlabs.com/dashboard" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,${color},#7C3AED);border-radius:10px;font-size:13px;font-weight:700;color:#FFFFFF;text-decoration:none;">
                      View Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:#4B5563;line-height:1.5;">
                You're receiving this because you have alerts enabled on STEINZ LABS.
                <br />To manage your notification preferences, visit your <a href="https://steinzlabs.com/dashboard" style="color:${color};text-decoration:none;">profile settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { title, message, type, userEmail } = await req.json();

    if (!title || !message || !userEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

    if (!RESEND_API_KEY && !SENDGRID_API_KEY) {

      return NextResponse.json({ skipped: true, reason: 'Email API not configured' });
    }

    const htmlBody = buildEmailHtml(title, message, type || 'system');

    if (RESEND_API_KEY) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'alerts@steinz.app',
          to: userEmail,
          subject: title,
          html: htmlBody,
        }),
      });

      if (!resendRes.ok) {
        const errData = await resendRes.json().catch(() => ({}));

        return NextResponse.json({ error: 'Failed to send email via Resend', details: errData }, { status: 502 });
      }

      const resData = await resendRes.json();
      return NextResponse.json({ sent: true, provider: 'resend', id: resData.id });
    }

    if (SENDGRID_API_KEY) {
      const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: userEmail }] }],
          from: { email: 'alerts@steinz.app', name: 'STEINZ LABS' },
          subject: title,
          content: [{ type: 'text/html', value: htmlBody }],
        }),
      });

      if (!sgRes.ok) {

        return NextResponse.json({ error: 'Failed to send email via SendGrid' }, { status: 502 });
      }

      return NextResponse.json({ sent: true, provider: 'sendgrid' });
    }

    return NextResponse.json({ skipped: true, reason: 'No email provider configured' });
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
