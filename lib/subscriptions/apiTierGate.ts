import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkTier, type Tier } from "./tierCheck";

/**
 * Server-side tier gate. Wraps a Next.js route handler and returns
 *   403 { error: 'upgrade_required', currentTier, requiredTier, expired }
 * when the authenticated user's tier is below the required tier. Admins
 * (profiles.role='admin') bypass regardless of tier.
 *
 * Generic over the route-params shape so dynamic routes (/[id], /[address])
 * keep their narrow types after wrapping — required by Next 15's strict
 * RouteHandlerConfig validator.
 */

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
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
}

export function withTierGate<TCtx>(
  requiredTier: Tier,
  handler: (request: NextRequest, ctx: TCtx) => Promise<Response> | Response,
): (request: NextRequest, ctx: TCtx) => Promise<Response> {
  return async (request, ctx) => {
    const sb = getSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("tier,tier_expires_at,role")
      .eq("id", user.id)
      .single<{ tier: string | null; tier_expires_at: string | null; role: string | null }>();

    const isAdmin = profile?.role === "admin";
    const check = checkTier(profile?.tier, profile?.tier_expires_at, requiredTier);

    if (!isAdmin && !check.allowed) {
      return NextResponse.json(
        {
          error: "upgrade_required",
          currentTier: check.currentTier,
          requiredTier: check.requiredTier,
          expired: check.expired,
        },
        { status: 403 },
      );
    }

    return handler(request, ctx);
  };
}
