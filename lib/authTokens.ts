import 'server-only';

export function generateVerifyToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'steinz-verify-secret';
  const data = `${userId}:${email}:${secret}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const b64 = Buffer.from(`${userId.slice(0, 8)}${hex}${email.slice(0, 4)}`).toString('base64url');
  return b64;
}

export function generateResetToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'steinz-reset-secret';
  const hour = Math.floor(Date.now() / (1000 * 60 * 60));
  const data = `${userId}:${email}:${secret}:${hour}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return Buffer.from(`${userId.slice(0, 8)}${hex}reset`).toString('base64url');
}

export function validateResetToken(userId: string, email: string, token: string): boolean {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'steinz-reset-secret';
  const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));

  for (let offset = 0; offset <= 1; offset++) {
    const hour = currentHour - offset;
    const data = `${userId}:${email}:${secret}:${hour}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    const expected = Buffer.from(`${userId.slice(0, 8)}${hex}reset`).toString('base64url');
    if (token === expected) return true;
  }
  return false;
}
