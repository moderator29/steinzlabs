import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeAddress } from "@/lib/utils/addressNormalize";
import { sendPushToUser } from "@/lib/services/webpush";
import { sendTelegramNotification } from "@/lib/telegram/notify";
import { sendWhaleAlert } from "@/lib/services/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAME = "whale-alert-monitor";

/**
 * whale-alert-monitor — the missing dispatcher. Joins user_whale_follows (with
 * alert_enabled) to fresh whale_activity and fans each new move out to the
 * user's chosen channels: a notifications row (real-time bell), web push,
 * Telegram, and email. Dedupes per follow via last_alerted_at so a user is
 * never re-pinged for a move they already saw. Exits instantly when nobody has
 * whale alerts enabled.
 *
 * sendWhaleAlert (email) was defined months ago but never called; this is the
 * caller. Runs in the ~2-minute `frequent` dispatch group.
 */

const LOOKBACK_MS = 15 * 60 * 1000; // safety window; last_alerted_at is the real dedupe
const MAX_ALERTS_PER_FOLLOW = 3; // don't flood on a burst of moves

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
  whale_address: string;
  chain: string;
  action: string;
  token_symbol: string | null;
  token_address: string | null;
  value_usd: number | null;
  tx_hash: string;
  timestamp: string;
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function emailDirection(action: string): "buy" | "sell" | "transfer" {
  if (action === "buy") return "buy";
  if (action === "sell") return "sell";
  return "transfer";
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  const sb = getSupabaseAdmin();

  try {
    const { data: follows } = await sb
      .from("user_whale_follows")
      .select("id,user_id,whale_address,chain,label,alert_threshold_usd,alert_channels,last_alerted_at")
      .eq("alert_enabled", true)
      .limit(2000)
      .returns<FollowRow[]>();

    if (!follows || follows.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, follows: 0, notified: 0 });
    }

    // Pull recent priced activity for every followed whale in one query.
    const sinceIso = new Date(Date.now() - LOOKBACK_MS).toISOString();
    const followedAddrs = Array.from(new Set(follows.map((f) => f.whale_address)));
    const { data: activity } = await sb
      .from("whale_activity")
      .select("whale_address,chain,action,token_symbol,token_address,value_usd,tx_hash,timestamp")
      .in("whale_address", followedAddrs)
      .gte("timestamp", sinceIso)
      .not("value_usd", "is", null)
      .order("timestamp", { ascending: false })
      .limit(1000)
      .returns<ActivityRow[]>();

    const acts = activity ?? [];
    if (acts.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, 0);
      return NextResponse.json({ ok: true, follows: follows.length, notified: 0 });
    }

    // Bucket activity by normalized chain:address so a follow can pull its
    // whale's moves with a Solana-safe match.
    const actByWhale = new Map<string, ActivityRow[]>();
    for (const a of acts) {
      const key = `${a.chain}:${normalizeAddress(a.whale_address, a.chain)}`;
      const arr = actByWhale.get(key) ?? [];
      arr.push(a);
      actByWhale.set(key, arr);
    }

    const emailCache = new Map<string, string | null>();
    const resolveEmail = async (userId: string): Promise<string | null> => {
      if (emailCache.has(userId)) return emailCache.get(userId)!;
      let email: string | null = null;
      try {
        const { data } = await sb.auth.admin.getUserById(userId);
        email = data.user?.email ?? null;
      } catch { /* leave null */ }
      emailCache.set(userId, email);
      return email;
    };

    let notified = 0;

    for (const f of follows) {
      const key = `${f.chain}:${normalizeAddress(f.whale_address, f.chain)}`;
      const whaleActs = actByWhale.get(key);
      if (!whaleActs || whaleActs.length === 0) continue;

      const threshold = Number(f.alert_threshold_usd ?? 0);
      const lastAt = f.last_alerted_at ? new Date(f.last_alerted_at).getTime() : 0;
      const fresh = whaleActs
        .filter((a) => Number(a.value_usd ?? 0) >= threshold && new Date(a.timestamp).getTime() > lastAt)
        .slice(0, MAX_ALERTS_PER_FOLLOW);
      if (fresh.length === 0) continue;

      const channels = (f.alert_channels && f.alert_channels.length > 0 ? f.alert_channels : ["push"]).map((c) => c.toLowerCase());
      const whaleName = f.label || `${f.whale_address.slice(0, 6)}…${f.whale_address.slice(-4)}`;
      const url = `/dashboard/whale-tracker/${f.whale_address}?chain=${f.chain}`;

      for (const a of fresh) {
        const usd = Number(a.value_usd ?? 0);
        const verb = a.action === "buy" ? "bought" : a.action === "sell" ? "sold" : a.action === "swap" ? "swapped" : "moved";
        const sym = a.token_symbol ? `$${a.token_symbol}` : "tokens";
        const title = `🐋 ${whaleName} ${verb} ${fmtUsd(usd)}`;
        const body = `${whaleName} ${verb} ${fmtUsd(usd)} of ${sym} on ${a.chain}.`;

        // Real-time bell (notifications publication).
        await sb.from("notifications").insert({
          user_id: f.user_id,
          type: "whale.alert",
          title,
          body,
          url,
          metadata: { follow_id: f.id, whale: f.whale_address, chain: a.chain, tx_hash: a.tx_hash, value_usd: usd, action: a.action },
          read: false,
        });

        // Fan out to the user's chosen channels; failures are isolated.
        const tasks: Promise<unknown>[] = [];
        if (channels.includes("push")) {
          tasks.push(sendPushToUser(f.user_id, { title, body, url, tag: `whale-${f.whale_address}` }).catch((e) => Sentry.captureException(e, { tags: { cron: NAME, channel: "push" } })));
        }
        if (channels.includes("telegram")) {
          tasks.push(sendTelegramNotification({ userId: f.user_id, kind: "whale", title, body, url }).catch((e) => Sentry.captureException(e, { tags: { cron: NAME, channel: "telegram" } })));
        }
        if (channels.includes("email")) {
          tasks.push(
            resolveEmail(f.user_id).then((email) => {
              if (!email) return;
              return sendWhaleAlert({
                to: email,
                symbol: a.token_symbol ?? "tokens",
                amountUsd: usd,
                direction: emailDirection(a.action),
                txHash: a.tx_hash,
              });
            }).catch((e) => Sentry.captureException(e, { tags: { cron: NAME, channel: "email" } })),
          );
        }
        await Promise.allSettled(tasks);
        notified++;
      }

      // Advance the dedupe cursor to the newest move we just alerted on.
      const newest = fresh.reduce((m, a) => (new Date(a.timestamp).getTime() > new Date(m.timestamp).getTime() ? a : m), fresh[0]);
      await sb.from("user_whale_follows").update({ last_alerted_at: newest.timestamp }).eq("id", f.id);
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, notified);
    return NextResponse.json({ ok: true, follows: follows.length, notified });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
