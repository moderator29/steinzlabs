import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { validateVerifyToken } from '@/lib/authTokens';
import { getSiteUrl } from '@/lib/siteUrl';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const userId = url.searchParams.get('uid');

    if (!token || !userId) {
      return NextResponse.redirect(`${getSiteUrl()}/login?error=invalid_link`);
    }

    const admin = getSupabaseAdmin();

    const { data: { user }, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !user) {
      return NextResponse.redirect(`${getSiteUrl()}/login?error=user_not_found`);
    }

    const ok = await validateVerifyToken(userId, token);
    if (!ok) {
      return NextResponse.redirect(`${getSiteUrl()}/login?error=invalid_token`);
    }

    if (!user.email_confirmed_at) {
      await admin.auth.admin.updateUserById(userId, { email_confirm: true });

    } else {

    }

    // Generate a magic link, extract its token, then redirect the user to
    // OUR callback page — we never let Supabase do the redirect so we avoid
    // the redirect-URL allowlist issue entirely.
    try {
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: user.email!,
      });

      const actionLink = linkData?.properties?.action_link;
      if (actionLink) {
        const supabaseUrl = new URL(actionLink);
        const tokenHash = supabaseUrl.searchParams.get('token');
        if (tokenHash) {
          return NextResponse.redirect(
            `${getSiteUrl()}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`
          );
        }
      }
    } catch (linkErr: any) {

    }

    // Fallback — user verifies but signs in manually
    return NextResponse.redirect(`${getSiteUrl()}/login?verified=true`);
  } catch (err: any) {

    return NextResponse.redirect(`${getSiteUrl()}/login?error=verify_failed`);
  }
}
