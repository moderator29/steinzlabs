// NOTE: Scheduled via /vercel.json — every 5 minutes.
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRedis } from "@/lib/cache/redis";
import { sendTelegramMessage } from "@/lib/telegram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NAME = "health-watch";

type Status = "active" | "warning" | "error" | "inactive";

interface CheckResult {
  name: string;
  status: Status;
  latencyMs: number;
  message?: string;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<null>((resolve) => {
        t = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

async function checkRedis(): Promise<CheckResult> {
  const redis = getRedis();
  if (!redis) return { name: "Upstash Redis", status: "inactive", latencyMs: 0, message: "Not configured" };
  const start = Date.now();
  const ok = await withTimeout(redis.set(`naka:health:cron:${start}`, "ok", { ex: 5 }), 2500);
  const latencyMs = Date.now() - start;
  if (ok === null) return { name: "Upstash Redis", status: "error", latencyMs, message: "Timeout > 2.5s" };
  if (latencyMs > 1500) return { name: "Upstash Redis", status: "warning", latencyMs, message: "Slow" };
  return { name: "Upstash Redis", status: "active", latencyMs };
}

async function checkSupabase(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await withTimeout(
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).then((r) => r.error ?? "ok"),
      3000,
    );
    const latencyMs = Date.now() - start;
    if (result === null) return { name: "Supabase", status: "error", latencyMs, message: "Timeout > 3s" };
    if (result !== "ok") return { name: "Supabase", status: "error", latencyMs, message: (result as { message: string }).message };
    if (latencyMs > 2000) return { name: "Supabase", status: "warning", latencyMs, message: "Slow" };
    return { name: "Supabase", status: "active", latencyMs };
  } catch (err) {
    return { name: "Supabase", status: "error", latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "error" };
  }
}

async function checkExternal(name: string, url: string, timeoutMs = 3000): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(timeoutMs) }).catch(() =>
      fetch(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) }),
    );
    const latencyMs = Date.now() - start;
    if (!res.ok) return { name, status: "error", latencyMs, message: `HTTP ${res.status}` };
    if (latencyMs > 2000) return { name, status: "warning", latencyMs, message: "Slow" };
    return { name, status: "active", latencyMs };
  } catch (err) {
    return { name, status: "error", latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "error" };
  }
}

const STATUS_EMOJI: Record<Status, string> = { active: "✅", warning: "⚠️", error: "🔴", inactive: "⚪" };

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  try {
    const admin = getSupabaseAdmin();

    // Run all checks in parallel.
    const [redisR, supabaseR, coingeckoR, dexR, anthropicR, alchemyR] = await Promise.all([
      checkRedis(),
      checkSupabase(admin),
      checkExternal("CoinGecko", "https://api.coingecko.com/api/v3/ping"),
      checkExternal("DexScreener", "https://api.dexscreener.com"),
      checkExternal("Anthropic Claude", "https://api.anthropic.com"),
      checkExternal("Alchemy (Ethereum)", "https://eth-mainnet.g.alchemy.com"),
    ]);
    const checks = [redisR, supabaseR, coingeckoR, dexR, anthropicR, alchemyR];

    // Load previous state, persist current, detect transitions.
    const { data: previous } = await admin
      .from("health_check_state")
      .select("check_name, status")
      .returns<{ check_name: string; status: Status }[]>();
    const prevMap = new Map((previous ?? []).map((r) => [r.check_name, r.status]));

    const transitions: Array<{ name: string; from: Status | "unknown"; to: Status; message?: string; latencyMs: number }> = [];

    for (const c of checks) {
      const prev = prevMap.get(c.name);
      if (prev !== c.status) {
        transitions.push({ name: c.name, from: prev ?? "unknown", to: c.status, message: c.message, latencyMs: c.latencyMs });
        await admin
          .from("health_check_state")
          .upsert(
            {
              check_name: c.name,
              status: c.status,
              latency_ms: c.latencyMs,
              message: c.message ?? null,
              changed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "check_name" },
          );
      } else {
        // Same status — bump updated_at only.
        await admin
          .from("health_check_state")
          .update({ latency_ms: c.latencyMs, message: c.message ?? null, updated_at: new Date().toISOString() })
          .eq("check_name", c.name);
      }
    }

    // Notify Telegram recipients on any transition INTO error/warning, OR
    // recovery from error/warning back to active. Skip noise transitions
    // (warning ↔ inactive).
    const notable = transitions.filter((t) => {
      if (t.to === "error" || t.to === "warning") return true;
      if (t.to === "active" && (t.from === "error" || t.from === "warning")) return true;
      return false;
    });

    if (notable.length > 0) {
      const { data: recipients } = await admin
        .from("health_alert_recipients")
        .select("telegram_chat_id")
        .eq("enabled", true)
        .returns<{ telegram_chat_id: string }[]>();

      if (recipients && recipients.length > 0) {
        const lines = notable.map((t) => {
          const arrow = `${STATUS_EMOJI[t.from === "unknown" ? "inactive" : t.from]} → ${STATUS_EMOJI[t.to]}`;
          const msg = t.message ? ` (${t.message})` : "";
          return `${arrow} ${t.name}${msg} · ${t.latencyMs}ms`;
        });
        const body = [
          `🚨 *Naka Labs infrastructure status changed*`,
          "",
          ...lines,
          "",
          `View admin: /admin/api-health`,
        ].join("\n");

        await Promise.allSettled(
          recipients.map((r) => sendTelegramMessage(r.telegram_chat_id, body, { parse_mode: "Markdown" })),
        );
      }
    }

    const errorCount = checks.filter((c) => c.status === "error").length;
    const warningCount = checks.filter((c) => c.status === "warning").length;
    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, checks.length);

    return NextResponse.json({
      ok: true,
      durationMs: duration,
      transitions: notable.length,
      errors: errorCount,
      warnings: warningCount,
      checks,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, 0);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
