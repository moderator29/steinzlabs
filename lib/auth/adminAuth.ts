import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Verifies that a request comes from an authenticated admin user.
 * Checks the Authorization: Bearer <token> header.
 * Returns the user id if valid admin, null otherwise.
 */
export async function verifyAdminRequest(request: Request): Promise<string | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    if (!token) return null;

    // Check static admin bearer token first (admin layout uses this)
    const adminBearerToken = process.env.ADMIN_BEARER_TOKEN;
    if (adminBearerToken && token === adminBearerToken) {
      return 'admin-bearer';
    }

    // Fallback: verify as Supabase JWT
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    // Check admin role in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') return null;

    return user.id;
  } catch {
    return null;
  }
}

export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
