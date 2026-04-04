import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../supabaseAdmin';

export async function getAuthenticatedUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const supabase = getSupabaseAdmin();
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        return { id: user.id, email: user.email || '' };
      }
    }

    const cookies = request.cookies;
    const sessionCookie = cookies.get('steinz_session')?.value;
    if (sessionCookie) {
      try {
        const decoded = JSON.parse(atob(sessionCookie.split('.')[1]));
        if (decoded.sub && decoded.exp > Date.now() / 1000) {
          return { id: decoded.sub, email: decoded.email || '' };
        }
      } catch {}
    }

    const sbCookies = Array.from(cookies.getAll()).filter(c => c.name.includes('auth-token'));
    for (const cookie of sbCookies) {
      try {
        const tokenData = JSON.parse(cookie.value);
        const accessToken = tokenData?.access_token || tokenData?.[0];
        if (accessToken) {
          const supabase = getSupabaseAdmin();
          const { data: { user }, error } = await supabase.auth.getUser(accessToken);
          if (!error && user) {
            return { id: user.id, email: user.email || '' };
          }
        }
      } catch {}
    }

    return null;
  } catch {
    return null;
  }
}
