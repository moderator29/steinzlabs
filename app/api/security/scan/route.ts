import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTokenSecurity } from "@/lib/services/goplus";
import { enrichAddress } from "@/lib/security/addressEnrich";
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

      // Also cache the raw GoPlus payload keyed by (token_address, chain) so the
      // Swap pre-trade intelligence strip (lib/dune/useSurfaces.ts) can read
      // honeypot / buy-sell-tax without re-hitting GoPlus on every quote.
      await admin.from("goplus_security_cache").upsert({
        token_address: body.target,
        chain,
        payload: rawObj,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "token_address,chain" });

      return NextResponse.json({ scan_type: "token", target: body.target, chain, ...assessment, raw: rawObj });
    }

    if (body.scan_type === "address") {
      // Multi-source: GoPlus flags + Etherscan verified-name/contract-verification
      // + Chainabuse community scam reports, merged transparently.
      const enrichment = await enrichAddress(body.target, chain);

      // Feed every corroborating signal into the shared scorer. `isScam` folds in
      // Chainabuse community reports; `isBlacklisted`/`isPhishing` come from GoPlus.
      const scoreInput: Record<string, unknown> = {
        isScam: (enrichment.scamReportCount ?? 0) > 0,
        isBlacklisted: enrichment.isBlacklisted,
        isPhishing: enrichment.isPhishing,
        isMalicious: enrichment.isMalicious,
      };
      const assessment = scoreAddressSecurity(scoreInput);
      // An unverified contract is a genuine (non-fatal) risk signal from Etherscan.
      if (enrichment.isUnverifiedContract && !assessment.reasons.includes("unverified_contract")) {
        assessment.reasons.push("unverified_contract");
      }

      const admin = getSupabaseAdmin();
      await admin.from("security_scan_history").insert({
        scan_type: "address",
        target: body.target,
        chain,
        risk_score: assessment.score,
        risk_level: assessment.level,
        reasons: assessment.reasons,
        goplus_raw: enrichment as unknown as Record<string, unknown>,
        scanned_by: user?.id ?? null,
      });

      return NextResponse.json({
        scan_type: "address",
        target: body.target,
        chain,
        ...assessment,
        label: enrichment.label,
        labelSource: enrichment.labelSource,
        creator: enrichment.creator,
        isContract: enrichment.isContract,
        isUnverifiedContract: enrichment.isUnverifiedContract,
        maliciousSourceCount: enrichment.maliciousSourceCount,
        scamReportCount: enrichment.scamReportCount,
        labels: enrichment.labels,
        sources: enrichment.sources,
        raw: enrichment,
      });
    }

    return NextResponse.json({ error: "unsupported scan_type" }, { status: 400 });
  } catch (err) {
    console.error("[api/security/scan]", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
