import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies as nextCookies } from 'next/headers';
import { getSupabaseAdmin } from '../supabaseAdmin';

/**
 * Resolve the authenticated user for an API route, trying (in order):
 *
 *   1. Authorization: Bearer <token> header (mobile / server-to-server)
 *   2. `steinz_session` legacy custom cookie (decoded JWT payload)
 *   3. Supabase SSR cookie chunks (sb-<ref>-auth-token[.0|.1|...])
 *      via @supabase/ssr createServerClient — this is the one the
 *      Telegram link-code button and other browser-initiated POSTs
 *      rely on. The old ad-hoc cookie parser below it broke on the
 *      newer `base64-...` chunked cookie format, which is why the
 *      Telegram button kept surfacing 'Unauthorized' even for a
 *      freshly-signed-in user.
 *   4. Legacy JSON auth-token cookie (pre-SSR @supabase/auth-helpers)
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    // 1. Bearer header
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

    // 2. Legacy signed cookie
    const sessionCookie = cookies.get('steinz_session')?.value;
    if (sessionCookie) {
      try {
        const decoded = JSON.parse(atob(sessionCookie.split('.')[1]));
        if (decoded.sub && decoded.exp > Date.now() / 1000) {
          return { id: decoded.sub, email: decoded.email || '' };
        }
      } catch {
        // Malformed cookie — ignore
      }
    }

    // 3. @supabase/ssr — this is the canonical path for browser-side
    //    fetches. Uses the same server client pattern as app/api/alerts
    //    and rehydrates from whichever sb-<ref>-auth-token chunk scheme
    //    the current Supabase SDK is writing (base64-prefixed, chunked,
    //    JSON — it all resolves through createServerClient).
    try {
      const cookieStore = await nextCookies();
      const ssr = createServerClient(
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
      const { data: { user }, error } = await ssr.auth.getUser();
      if (!error && user) {
        return { id: user.id, email: user.email || '' };
      }
    } catch {
      // next/headers not available in this context — fall through.
    }

    // 4. Legacy JSON auth-token cookie format (pre-SSR)
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
      } catch {
        // Malformed auth-token cookie — skip
      }
    }

    return null;
  } catch {
    return null;
  }
}
