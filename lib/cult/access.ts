/**
 * NakaCult / Vault access gate.
 *
 * A user can enter the Vault if their canonical tier is `naka_cult`.
 * Phase-4 sets the tier manually; a future on-chain resolver will
 * upgrade users to `naka_cult` automatically when their connected
 * wallet holds:
 *   - ≥ 600,000 $NAKA, OR
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
  if (!supabaseUrl || !anonKey) return DENIED;

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => { /* read-only path; no-op to avoid Next.js cookie writes outside Server Actions */ },
    },
  });

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return DENIED;

  const { data: profile } = await supabase
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

  return {
    allowed: result.allowed,
    userId: user.id,
    tier: result.currentTier,
    isChosen: !!profile?.is_chosen,
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
  };
}
