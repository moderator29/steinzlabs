import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkTier, type Tier, type TierCheckResult } from "./tierCheck";

/**
 * Server-side tier check for RSC layouts / pages. Returns the check result
 * plus an isAdmin flag (admins bypass all gates). Authenticated-but-missing
 * profile rows fall through to 'free'.
 */
export interface ServerTierCheck extends TierCheckResult {
  userId: string | null;
  isAdmin: boolean;
}

export async function checkTierServer(requiredTier: Tier): Promise<ServerTierCheck> {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );

  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return {
      allowed: false,
      currentTier: "free",
      requiredTier,
      expired: false,
      userId: null,
      isAdmin: false,
    };
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("tier,tier_expires_at,role")
    .eq("id", user.id)
    .single<{ tier: string | null; tier_expires_at: string | null; role: string | null }>();

  const isAdmin = profile?.role === "admin";
  const check = checkTier(profile?.tier, profile?.tier_expires_at, requiredTier);
  return {
    ...check,
    allowed: isAdmin || check.allowed,
    userId: user.id,
    isAdmin,
  };
}
