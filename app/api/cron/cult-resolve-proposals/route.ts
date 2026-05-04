import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 30;
export const runtime = "nodejs";

const NAME = "cult-resolve-proposals";
const MIN_VOTERS_FOR_PASS = 5;

type ProposalRow = {
  id: string;
  kind: "decree" | "whisper" | "treasury";
  stake_naka: string | number;
  yes_weight: string | number;
  no_weight: string | number;
  voter_count: number;
};

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  let processed = 0;

  try {
    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: due, error: selErr } = await admin
      .from("cult_proposals")
      .select("id, kind, stake_naka, yes_weight, no_weight, voter_count")
      .eq("status", "active")
      .lt("ends_at", nowIso);
    if (selErr) throw selErr;

    if (!due || due.length === 0) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, "success", duration, undefined, 0);
      return NextResponse.json({ ok: true, durationMs: duration, processed: 0 });
    }

    for (const p of due as ProposalRow[]) {
      const yes = Number(p.yes_weight);
      const no = Number(p.no_weight);
      const passes = yes > no && p.voter_count >= MIN_VOTERS_FOR_PASS;
      const nextStatus = passes ? "passed" : "failed";
      const slashed = !passes && p.kind === "decree" ? Number(p.stake_naka) : 0;

      const { error: updErr } = await admin
        .from("cult_proposals")
        .update({
          status: nextStatus,
          resolved_at: nowIso,
          resolved_by: `cron:${NAME}`,
          slashed_naka: slashed,
        })
        .eq("id", p.id)
        .eq("status", "active");
      if (updErr) {
        Sentry.captureException(updErr, { tags: { cron: NAME, proposal_id: p.id } });
        continue;
      }
      processed += 1;
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
