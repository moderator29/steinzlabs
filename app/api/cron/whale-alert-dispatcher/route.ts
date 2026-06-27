import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { canonicalAction } from "@/lib/whales/labels";
import { sendWhaleAlert } from "@/lib/services/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAME = "whale-alert-dispatcher";

// How many fresh moves to notify per follow per tick. A whale can fire many
// transfers between ticks; cap the fan-out so one busy whale can't bury a
// user's bell. The watermark still advances past everything scanned so we
// never re-alert the skipped overflow.
const MAX_ALERTS_PER_FOLLOW = 3;

// Cold-start floor: on the first run for a follow (last_alerted_at null) only
// look back this far, so following a whale never dumps its entire history.
const COLD_START_LOOKBACK_MS = 15 * 60 * 1000;

interface FollowRow {
  id: string;
  user_id: string;
  whale_address: string;
  chain: string;
  label: string | null;
  alert_threshold_usd: number | null;
  alert_channels: string[] | null;
  last_alerted_at: string | null;
}

interface ActivityRow {
  id: string;
  whale_address: string;
  chain: string;
  action: string;
  token_symbol: string | null;
  value_usd: number | null;
  counterparty_label: string | null;
  tx_hash: string;
  timestamp: string;
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/**
 * whale-alert-dispatcher — the missing link between user_whale_follows and
 * whale_activity. For every follow with alerts enabled it finds priced moves
 * newer than the follow's watermark that clear the user's USD threshold,
 * writes a durable in-app notification (real-time bell via the notifications
 * publication), and — when the follow opted into the 'email' channel — sends
 * the rich whale email via sendWhaleAlert. Advances last_alerted_at so a move
 * is never alerted twice. Exits instantly when nobody has alerts enabled.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let notified = 0;
  let emailed = 0;

  try {
    const sb = getSupabaseAdmin();

    const { data: follows, error: followErr } = await sb
      .from("user_whale_follows")
      .select("id, user_id, whale_address, chain, label, alert_threshold_usd, alert_channels, last_alerted_at")
      .eq("alert_enabled", true)
      .limit(2000);
    if (followErr) throw followErr;

    const list = (follows ?? []) as FollowRow[];
    if (list.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, follows: 0, notified: 0 });
    }

    // Cache one email lookup per user across their follows.
    const emailCache = new Map<string, string | null>();
    const resolveEmail = async (userId: string): Promise<string | null> => {
      if (emailCache.has(userId)) return emailCache.get(userId) ?? null;
      const { data } = await sb.from("profiles").select("email").eq("id", userId).maybeSingle<{ email: string | null }>();
      const email = data?.email ?? null;
      emailCache.set(userId, email);
      return email;
    };

    for (const f of list) {
      const sinceMs = f.last_alerted_at
        ? new Date(f.last_alerted_at).getTime()
        : Date.now() - COLD_START_LOOKBACK_MS;
      const sinceIso = new Date(sinceMs).toISOString();
      const threshold = f.alert_threshold_usd != null ? Number(f.alert_threshold_usd) : 0;

      // Newest priced moves for this whale since the watermark, ascending so we
      // notify in chronological order and stamp the watermark at the latest.
      const { data: acts } = await sb
        .from("whale_activity")
        .select("id, whale_address, chain, action, token_symbol, value_usd, counterparty_label, tx_hash, timestamp")
        .ilike("whale_address", f.whale_address)
        .eq("chain", f.chain)
        .gt("timestamp", sinceIso)
        .not("value_usd", "is", null)
        .gte("value_usd", threshold)
        .order("timestamp", { ascending: true })
        .limit(50);

      const rows = (acts ?? []) as ActivityRow[];
      if (rows.length === 0) continue;

      const channels = (f.alert_channels ?? []) as string[];
      const wantsEmail = channels.includes("email");
      const userEmail = wantsEmail ? await resolveEmail(f.user_id) : null;
      const whaleName = f.label || `${f.whale_address.slice(0, 6)}…${f.whale_address.slice(-4)}`;

      // Notify the most recent N; the watermark still advances past all scanned.
      const toNotify = rows.slice(-MAX_ALERTS_PER_FOLLOW);
      for (const a of toNotify) {
        const dir = canonicalAction(a.action);
        const usd = Number(a.value_usd ?? 0);
        const verb = dir === "buy" ? "bought" : dir === "sell" ? "sold" : "moved";
        const sym = a.token_symbol ? `$${a.token_symbol}` : "tokens";

        await sb.from("notifications").insert({
          user_id: f.user_id,
          type: "whale.alert",
          title: `🐋 ${whaleName} ${verb} ${fmtUsd(usd)}`,
          body: `${whaleName} ${verb} ${fmtUsd(usd)} of ${sym} on ${a.chain}.`,
          url: `/dashboard/whale-tracker/${a.whale_address}?chain=${a.chain}`,
          metadata: { follow_id: f.id, tx_hash: a.tx_hash, value_usd: usd, action: a.action, chain: a.chain },
          read: false,
        });
        notified++;

        if (wantsEmail && userEmail) {
          const res = await sendWhaleAlert({
            to: userEmail,
            symbol: a.token_symbol || "token",
            amountUsd: usd,
            direction: dir,
            fromEntity: dir === "sell" ? whaleName : a.counterparty_label ?? undefined,
            toEntity: dir === "buy" ? whaleName : a.counterparty_label ?? undefined,
            txHash: a.tx_hash,
          });
          if (res.ok) emailed++;
        }
      }

      // Advance the watermark to the newest move scanned (not just notified) so
      // the capped overflow isn't re-sent next tick.
      const newest = rows[rows.length - 1].timestamp;
      await sb
        .from("user_whale_follows")
        .update({ last_alerted_at: newest })
        .eq("id", f.id)
        // Only move forward — guard against an overlapping tick rewinding it.
        .or(`last_alerted_at.is.null,last_alerted_at.lt.${newest}`);
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, notified);
    return NextResponse.json({ ok: true, follows: list.length, notified, emailed });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
