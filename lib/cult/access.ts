/**
 * NakaCult / Vault access gate.
 *
 * Cult membership is a standalone entitlement (profiles.cult_member),
 * fully decoupled from the platform tier ladder. A user enters the Vault
 * iff cult_member = true, regardless of their free/mini/pro/max tier.
 * The resolver branch sets cult_member from on-chain state:
 *   - a NIPPO NFT (0x6941…), OR
 *   - a >= 1,227,000 $NAKA balance
 * (The Founder Pass NFT grants Max-tier platform access, NOT cult access.)
 *
 * Server-side only. Reads the authenticated user's profile via the
 * server Supabase client; admins are NOT auto-granted access — the
 * Vault is intentionally exclusive even from staff.
 */

import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import * as Sentry from "@sentry/nextjs";
import { normalizeTier, type Tier } from "@/lib/subscriptions/tierCheck";

/**
 * Surface a denial both to the Vercel runtime log (instant grep) AND
 * to Sentry (daily digest, owner-visible). console.warn alone wasn't
 * reaching the owner's Sentry feed which is where they actually
 * monitor — they got zero events for the Vault "try again" loop and
 * thought the diagnostic was broken. captureMessage with structured
 * tags makes the denial filterable in Sentry by reason.
 */
// no-user / not-cult-member are the EXPECTED outcome on the public /naka-cult
// landing (most visitors aren't members), so paging Sentry on every one
// flooded the dashboard. Only genuinely anomalous denials (auth/profile
// errors) go to Sentry; the expected ones stay console-only.
const EXPECTED_DENIALS = new Set(['no-user', 'not-cult-member']);
function reportDenial(reason: string, context: Record<string, unknown>) {
  console.warn(`[cult/access] DENIED ${reason}`, context);
  if (EXPECTED_DENIALS.has(reason)) return;
  Sentry.captureMessage(`cult-access-denied: ${reason}`, {
    level: 'warning',
    tags: { area: 'cult-access', reason },
    contexts: { 'cult-access': context as Record<string, unknown> },
  });
}

export interface CultAccess {
  allowed: boolean;
  userId: string | null;
  tier: Tier;
  username: string | null;
  displayName: string | null;
}

const DENIED: CultAccess = {
  allowed: false,
  userId: null,
  tier: "free",
  username: null,
  displayName: null,
};

export async function getCultAccess(): Promise<CultAccess> {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    reportDenial('env-missing', {
      hasSupabaseUrl: !!supabaseUrl,
      hasAnonKey: !!anonKey,
    });
    return DENIED;
  }

  const allCookies = cookieStore.getAll();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => allCookies,
      setAll: () => { /* read-only path; no-op to avoid Next.js cookie writes outside Server Actions */ },
    },
  });

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    reportDenial('no-user', {
      cookieCount: allCookies.length,
      hasSbCookie: allCookies.some((c) => c.name.startsWith('sb-')),
      sbCookieNames: allCookies.filter((c) => c.name.startsWith('sb-')).map((c) => c.name),
      authError: authErr?.message ?? null,
    });
    return DENIED;
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("tier, cult_member, cult_source, username, display_name")
    .eq("id", user.id)
    .maybeSingle<{
      tier: string | null;
      cult_member: boolean | null;
      cult_source: string | null;
      username: string | null;
      display_name: string | null;
    }>();

  const allowed = !!profile?.cult_member;

  if (!allowed) {
    reportDenial('not-cult-member', {
      userId: user.id,
      cultMember: profile?.cult_member ?? null,
      cultSource: profile?.cult_source ?? null,
      profileError: profileErr?.message ?? null,
    });
  }

  return {
    allowed,
    userId: user.id,
    tier: normalizeTier(profile?.tier),
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
  };
}
