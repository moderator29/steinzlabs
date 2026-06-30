import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { canonicalAction } from "@/lib/whales/labels";
import { sendWhaleAlert } from "@/lib/services/resend";
import { sendTelegramNotification } from "@/lib/telegram/notify";
import { sendPushToUser } from "@/lib/services/webpush";

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
  let telegrammed = 0;
  let pushed = 0;

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
      // Email lives in auth.users, NOT profiles (profiles has no email column —
      // a profiles.select('email') silently errors → null → the email channel
      // never fired). Resolve via the admin auth API like the follow route does.
      const { data } = await sb.auth.admin.getUserById(userId);
      const email = data?.user?.email ?? null;
      emailCache.set(userId, email);
      return email;
    };

    // Cache whale stats per address for the rich email enrichment + AI take.
    type WhaleStat = { label: string | null; whale_score: number | null; archetype: string | null; entity_type: string | null; active_days_7d: number | null };
    const whaleCache = new Map<string, WhaleStat | null>();
    const resolveWhale = async (address: string, chain: string): Promise<WhaleStat | null> => {
      const key = `${chain}:${address}`;
      if (whaleCache.has(key)) return whaleCache.get(key) ?? null;
      const { data } = await sb.from('whales')
        .select('label, whale_score, archetype, entity_type, active_days_7d')
        .eq('address', address).eq('chain', chain).maybeSingle();
      whaleCache.set(key, (data as WhaleStat | null) ?? null);
      return (data as WhaleStat | null) ?? null;
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
      const wantsTelegram = channels.includes("telegram");
      const wantsPush = channels.includes("push");
      const userEmail = wantsEmail ? await resolveEmail(f.user_id) : null;
      const whaleName = f.label || `${f.whale_address.slice(0, 6)}…${f.whale_address.slice(-4)}`;

      // Notify the most recent N; the watermark still advances past all scanned.
      const toNotify = rows.slice(-MAX_ALERTS_PER_FOLLOW);
      for (const a of toNotify) {
        const dir = canonicalAction(a.action);
        const usd = Number(a.value_usd ?? 0);
        const verb = dir === "buy" ? "bought" : dir === "sell" ? "sold" : "moved";
        const sym = a.token_symbol ? `$${a.token_symbol}` : "tokens";
        const title = `🐋 ${whaleName} ${verb} ${fmtUsd(usd)}`;
        const bodyText = `${whaleName} ${verb} ${fmtUsd(usd)} of ${sym} on ${a.chain}.`;
        const url = `/dashboard/whale-tracker/${a.whale_address}?chain=${a.chain}`;

        // In-app bell (always — durable, drives the realtime notifications feed).
        await sb.from("notifications").insert({
          user_id: f.user_id,
          type: "whale.alert",
          title,
          body: bodyText,
          url,
          metadata: { follow_id: f.id, tx_hash: a.tx_hash, value_usd: usd, action: a.action, chain: a.chain },
          read: false,
        });
        notified++;

        // Fan out to every channel the follow opted into. Each is best-effort
        // and independent so one slow/failed provider can't block the others or
        // the watermark advance. Telegram self-checks link + quiet hours; push
        // self-checks subscriptions; email needs a resolved address.
        if (wantsEmail && userEmail) {
          // Enrich with the whale's real stats and a GROUNDED one-liner (built
          // only from real fields — archetype, activity, score — never invented).
          const w = await resolveWhale(f.whale_address, f.chain);
          const chainCap = f.chain.charAt(0).toUpperCase() + f.chain.slice(1);
          let aiTake: string | null = null;
          if (w) {
            const arche = (w.archetype || w.entity_type || 'wallet').replace(/_/g, ' ');
            const moveWord = dir === 'buy' ? 'accumulating' : dir === 'sell' ? 'distributing' : 'moving';
            const bits = [`${arche.charAt(0).toUpperCase() + arche.slice(1)} ${moveWord} ${sym}`];
            if (typeof w.active_days_7d === 'number' && w.active_days_7d > 0) bits.push(`active ${w.active_days_7d}/7 days`);
            if (typeof w.whale_score === 'number') bits.push(`Naka score ${w.whale_score}`);
            aiTake = bits.join('  ·  ') + '.';
          }
          const res = await sendWhaleAlert({
            to: userEmail,
            symbol: a.token_symbol || "token",
            amountUsd: usd,
            direction: dir,
            fromEntity: dir === "sell" ? whaleName : a.counterparty_label ?? undefined,
            toEntity: dir === "buy" ? whaleName : a.counterparty_label ?? undefined,
            txHash: a.tx_hash,
            whaleName,
            whaleAddress: f.whale_address,
            chain: f.chain,
            whaleScore: w?.whale_score ?? null,
            archetype: w?.archetype ?? null,
            entityType: w?.entity_type ?? null,
            activeDays7d: w?.active_days_7d ?? null,
            aiTake,
            viewUrl: `https://nakalabs.xyz/dashboard/whale-tracker/${f.whale_address}?chain=${f.chain}`,
          });
          if (res.ok) emailed++;
        }
        if (wantsTelegram) {
          try {
            const ok = await sendTelegramNotification({ userId: f.user_id, kind: "whale", title, body: bodyText, url });
            if (ok) telegrammed++;
          } catch { /* delivery failure already logged in notify.ts */ }
        }
        if (wantsPush) {
          try {
            await sendPushToUser(f.user_id, { title, body: bodyText, url, tag: `whale-${a.whale_address}` });
            pushed++;
          } catch { /* push best-effort */ }
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
    return NextResponse.json({ ok: true, follows: list.length, notified, emailed, telegrammed, pushed });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
