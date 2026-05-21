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
import { checkTier, type Tier } from "@/lib/subscriptions/tierCheck";

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
    // §vault-entry-retry-loop — owner reports a "try again" loop on
    // /vault even though their DB row has tier=naka_cult, is_chosen=true,
    // tier_expires_at=null. Diagnostic logging surfaces the exact denial
    // reason on the next prod hit. Once the loop is reproduced server-
    // side and root-caused, this logging can be reduced or removed.
    console.warn('[cult/access] DENIED env: supabaseUrl or anonKey missing');
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
    console.warn('[cult/access] DENIED no-user', {
      cookieCount: allCookies.length,
      hasSbCookie: allCookies.some((c) => c.name.startsWith('sb-')),
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
    console.warn('[cult/access] DENIED tier-check', {
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
