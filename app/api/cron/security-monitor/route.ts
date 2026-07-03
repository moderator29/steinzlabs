import { logger } from '@/lib/logger';
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
    // Source of real, scannable tokens: user_custom_tokens holds the CONTRACT
    // addresses (chain + contract) users imported into their wallet — unlike
    // `watchlist`, whose token_id is a CoinGecko id ("bitcoin") that GoPlus
    // cannot scan. That mismatch is why this cron produced nothing. We pull
    // user_id so we can write the PER-USER security-center feeds
    // (user_token_security_flags + security_alerts) that previously had no
    // producer and left the threat feed / honeypot score permanently empty.
    const { data: rows } = await supabase
      .from("user_custom_tokens")
      .select("contract, chain, user_id")
      .limit(1000);
    if (!rows || rows.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, skipped: "no-custom-tokens", processed: 0 });
    }
    // Scan each distinct token once; remember which users hold it.
    const tokens = new Map<string, { token_id: string; chain: string; userIds: Set<string> }>();
    (rows as Array<{ contract: string; chain: string; user_id: string | null }>).forEach((r) => {
      if (!r.contract || !r.chain) return;
      const key = `${r.chain}:${r.contract.toLowerCase()}`;
      const entry = tokens.get(key) ?? { token_id: r.contract, chain: r.chain, userIds: new Set<string>() };
      if (r.user_id) entry.userIds.add(r.user_id);
      tokens.set(key, entry);
    });

    for (const { token_id, chain, userIds } of tokens.values()) {
      try {
        const res = await getTokenSecurity(token_id, chain);
        if (!res) continue;
        const scored = scoreFromResult(res as unknown as Record<string, never>);
        const { score, level, reasons } = scored;
        const isHoneypot = !!(res as { isHoneypot?: boolean }).isHoneypot;
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

        // Per-user flags for every watcher; alerts only when genuinely risky.
        const dangerous = level === "high" || level === "critical" || isHoneypot;
        for (const userId of userIds) {
          await supabase
            .from("user_token_security_flags")
            .upsert(
              {
                user_id: userId,
                token_address: token_id,
                chain,
                is_honeypot: isHoneypot,
                risk_level: level,
                risk_score: score,
                risk_reasons: reasons,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,token_address,chain" },
            );

          if (dangerous) {
            // Dedup: skip if an unacknowledged alert for this token already
            // exists in the last 7 days.
            const { count } = await supabase
              .from("security_alerts")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("target", token_id)
              .eq("acknowledged", false)
              .gt("created_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString());
            if ((count ?? 0) === 0) {
              await supabase.from("security_alerts").insert({
                user_id: userId,
                severity: isHoneypot || level === "critical" ? "critical" : "warn",
                title: isHoneypot ? "Honeypot token in your watchlist" : `High-risk token (${level})`,
                description: `${token_id.slice(0, 10)}… on ${chain} scored ${score}/100${reasons.length ? ` — ${reasons.join(", ")}` : ""}.`,
                source: "goplus",
                category: "token_risk",
                target: token_id,
                acknowledged: false,
                metadata: { chain, risk_level: level, risk_score: score, reasons },
              });
            }
          }
        }
        processed++;
      } catch (err) {
        logger.error({ err, chain, token_id }, `[${NAME}] token failed`);
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
