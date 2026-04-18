import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTokenSecurity, getAddressSecurity } from "@/lib/services/goplus";
import { scoreTokenSecurity, scoreAddressSecurity } from "@/lib/security/scorer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const body = (await request.json()) as {
    scan_type?: "token" | "address";
    target?: string;
    chain?: string;
  };
  if (!body.scan_type || !body.target) {
    return NextResponse.json({ error: "scan_type and target required" }, { status: 400 });
  }
  const chain = body.chain ?? "ethereum";

  try {
    if (body.scan_type === "token") {
      const raw = await getTokenSecurity(body.target, chain);
      const rawObj = (raw as unknown as Record<string, unknown>) ?? {};
      const assessment = scoreTokenSecurity(rawObj);

      const admin = getSupabaseAdmin();
      await admin.from("security_scan_history").insert({
        scan_type: "token",
        target: body.target,
        chain,
        risk_score: assessment.score,
        risk_level: assessment.level,
        reasons: assessment.reasons,
        goplus_raw: rawObj,
        scanned_by: user?.id ?? null,
      });

      return NextResponse.json({ scan_type: "token", target: body.target, chain, ...assessment, raw: rawObj });
    }

    if (body.scan_type === "address") {
      const raw = await getAddressSecurity(body.target, chain);
      const rawObj = (raw as unknown as Record<string, unknown>) ?? {};
      const assessment = scoreAddressSecurity(rawObj);

      const admin = getSupabaseAdmin();
      await admin.from("security_scan_history").insert({
        scan_type: "address",
        target: body.target,
        chain,
        risk_score: assessment.score,
        risk_level: assessment.level,
        reasons: assessment.reasons,
        goplus_raw: rawObj,
        scanned_by: user?.id ?? null,
      });

      return NextResponse.json({ scan_type: "address", target: body.target, chain, ...assessment, raw: rawObj });
    }

    return NextResponse.json({ error: "unsupported scan_type" }, { status: 400 });
  } catch (err) {
    console.error("[api/security/scan]", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
