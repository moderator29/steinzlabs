import 'server-only';

const RESEND_API_URL = 'https://api.resend.com/emails';

function getResendKey(): string {
  return (process.env.RESEND_API_KEY || '').trim();
}

export async function sendVerificationEmail(
  to: string,
  confirmUrl: string,
  firstName: string
): Promise<boolean> {
  const apiKey = getResendKey();
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set');
    return false;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0e1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#111827;border-radius:16px;border:1px solid #1e293b;overflow:hidden;">
          <tr>
            <td style="padding:40px 32px 24px;text-align:center;">
              <div style="width:56px;height:56px;margin:0 auto 24px;background:linear-gradient(135deg,#0A1EFF,#0815B3);border-radius:14px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:28px;color:#fff;">&#x1F6E1;</span>
              </div>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Verify your email</h1>
              <p style="margin:0;font-size:14px;color:#94a3b8;">Welcome to STEINZ LABS, ${firstName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#cbd5e1;">Click the button below to verify your email address and activate your STEINZ LABS account.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${confirmUrl}" style="display:inline-block;padding:14px 40px;background-color:#0A1EFF;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:10px;letter-spacing:0.3px;">Verify Email</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#64748b;">If you didn't create a STEINZ LABS account, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;font-size:11px;color:#475569;">&copy; STEINZ LABS. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'STEINZ LABS <noreply@steinzlabs.com>',
        to: [to],
        subject: 'Verify your STEINZ LABS account',
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('[Email] Resend error:', JSON.stringify(result));
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[Email] send failed:', err.message);
    return false;
  }
}
