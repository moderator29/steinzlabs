/**
 * NakaCult / Vault access gate.
 *
 * A user can enter the Vault if their canonical tier is `naka_cult`.
 * Phase-4 sets the tier manually; a future on-chain resolver will
 * upgrade users to `naka_cult` automatically when their connected
 * wallet holds:
 *   - ≥ 1,227,000 $NAKA, OR
 *   - a NakaLabs Loyalty Gem NFT, OR
 *   - a NakaLabs Development NFT (also grants The Chosen Seal)
 *
 * Server-side only. Reads the authenticated user's profile via the
 * server Supabase client; admins are NOT auto-granted access — the
 * Vault is intentionally exclusive even from staff. Use the existing
 * tier ladder for general feature gating.
 */

import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import * as Sentry from "@sentry/nextjs";
import { checkTier, type Tier } from "@/lib/subscriptions/tierCheck";

/**
 * Surface a denial both to the Vercel runtime log (instant grep) AND
 * to Sentry (daily digest, owner-visible). console.warn alone wasn't
 * reaching the owner's Sentry feed which is where they actually
 * monitor — they got zero events for the Vault "try again" loop and
 * thought the diagnostic was broken. captureMessage with structured
 * tags makes the denial filterable in Sentry by reason.
 */
function reportDenial(reason: string, context: Record<string, unknown>) {
  console.warn(`[cult/access] DENIED ${reason}`, context);
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
  /** True when user has Development NFT path → Chosen Seal benefits. */
  isChosen: boolean;
  username: string | null;
  displayName: string | null;
}

const DENIED: CultAccess = {
  allowed: false,
  userId: null,
  tier: "free",
  isChosen: false,
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
    .select("tier, tier_expires_at, username, display_name, is_chosen")
    .eq("id", user.id)
    .maybeSingle<{
      tier: string | null;
      tier_expires_at: string | null;
      username: string | null;
      display_name: string | null;
      is_chosen: boolean | null;
    }>();

  const result = checkTier(profile?.tier ?? "free", profile?.tier_expires_at ?? null, "naka_cult");

  if (!result.allowed) {
    reportDenial('tier-check', {
      userId: user.id,
      rawTier: profile?.tier ?? null,
      currentTier: result.currentTier,
      expired: result.expired,
      tierExpiresAt: profile?.tier_expires_at ?? null,
      profileError: profileErr?.message ?? null,
    });
  }

  return {
    allowed: result.allowed,
    userId: user.id,
    tier: result.currentTier,
    isChosen: !!profile?.is_chosen,
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
  };
}
