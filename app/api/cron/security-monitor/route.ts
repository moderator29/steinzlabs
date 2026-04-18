import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTokenSecurity } from "@/lib/services/goplus";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "security-monitor";

function scoreFromResult(res: { isHoneypot?: boolean; isMintable?: boolean; ownerCanChangeBalance?: boolean; buyTax?: number; sellTax?: number }): {
  score: number;
  level: "safe" | "low" | "medium" | "high" | "critical";
  reasons: string[];
} {
  let score = 100;
  const reasons: string[] = [];
  if (res.isHoneypot) { score -= 60; reasons.push("honeypot"); }
  if (res.isMintable) { score -= 20; reasons.push("mintable"); }
  if (res.ownerCanChangeBalance) { score -= 25; reasons.push("owner_can_change_balance"); }
  if ((res.buyTax ?? 0) > 10) { score -= 15; reasons.push(`buy_tax_${res.buyTax}`); }
  if ((res.sellTax ?? 0) > 10) { score -= 15; reasons.push(`sell_tax_${res.sellTax}`); }
  score = Math.max(0, Math.min(100, score));
  const level: "safe" | "low" | "medium" | "high" | "critical" =
    score >= 85 ? "safe" : score >= 65 ? "low" : score >= 40 ? "medium" : score >= 20 ? "high" : "critical";
  return { score, level, reasons };
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let processed = 0;
  try {
    const supabase = getSupabaseAdmin();
    const { data: rows } = await supabase
      .from("watchlist")
      .select("token_id, chain")
      .limit(500);
    const uniq = new Map<string, { token_id: string; chain: string }>();
    (rows ?? []).forEach((r: { token_id: string; chain: string }) => {
      uniq.set(`${r.chain}:${r.token_id}`, r);
    });

    for (const { token_id, chain } of uniq.values()) {
      try {
        const res = await getTokenSecurity(token_id, chain);
        if (!res) continue;
        const { score, level, reasons } = scoreFromResult(res as unknown as Record<string, never>);
        await supabase
          .from("token_risk_scores")
          .upsert(
            {
              token_address: token_id,
              chain,
              risk_score: score,
              risk_level: level,
              risk_reasons: reasons,
              goplus_raw: res,
              scanned_at: new Date().toISOString(),
            },
            { onConflict: "token_address,chain" },
          );
        processed++;
      } catch (err) {
        console.error(`[${NAME}] token ${chain}:${token_id} failed`, err);
      }
    }

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, processed);
    return NextResponse.json({ ok: true, durationMs: duration, processed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, processed);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
