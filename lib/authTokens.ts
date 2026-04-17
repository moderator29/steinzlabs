import 'server-only';

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('[authTokens] JWT_SECRET environment variable is not set. Cannot generate secure tokens.');
  }
  return secret;
}

async function hmacToken(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const tokenData = encoder.encode(data);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, tokenData);
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateVerifyToken(userId: string, email: string): Promise<string> {
  const secret = getSecret();
  const hex = await hmacToken(`${userId}:${email}:verify`, secret);
  return Buffer.from(`${userId.slice(0, 8)}${hex.slice(0, 8)}${email.slice(0, 4)}`).toString('base64url');
}

export async function generateResetToken(userId: string, email: string): Promise<string> {
  const secret = getSecret();
  const hour = Math.floor(Date.now() / (1000 * 60 * 60));
  const hex = await hmacToken(`${userId}:${email}:reset:${hour}`, secret);
  return Buffer.from(`${userId.slice(0, 8)}${hex.slice(0, 8)}reset`).toString('base64url');
}

export async function validateResetToken(userId: string, email: string, token: string): Promise<boolean> {
  const secret = getSecret();
  const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));

  for (let offset = 0; offset <= 1; offset++) {
    const hour = currentHour - offset;
    const hex = await hmacToken(`${userId}:${email}:reset:${hour}`, secret);
    const expected = Buffer.from(`${userId.slice(0, 8)}${hex.slice(0, 8)}reset`).toString('base64url');
    if (token === expected) return true;
  }
  return false;
}
