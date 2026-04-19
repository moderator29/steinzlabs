import "server-only";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/cache/redis";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAdminRequest, unauthorizedResponse } from "@/lib/auth/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckResult {
  name: string;
  status: "active" | "warning" | "error" | "inactive";
  latencyMs: number;
  message?: string;
}

interface SummaryResponse {
  overall: "active" | "warning" | "error";
  degradedCount: number;
  errorCount: number;
  checks: CheckResult[];
  checkedAt: string;
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
  try {
    const ok = await withTimeout(redis.set(`naka:health:s:${start}`, "ok", { ex: 5 }), 2000);
    const latencyMs = Date.now() - start;
    if (ok === null) return { name: "Upstash Redis", status: "error", latencyMs, message: "Timeout > 2s" };
    if (latencyMs > 1500) return { name: "Upstash Redis", status: "warning", latencyMs, message: "Slow" };
    if (latencyMs > 300) return { name: "Upstash Redis", status: "warning", latencyMs, message: "Elevated latency" };
    return { name: "Upstash Redis", status: "active", latencyMs };
  } catch (err) {
    return { name: "Upstash Redis", status: "error", latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "error" };
  }
}

async function checkSupabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const admin = getSupabaseAdmin();
    const result = await withTimeout(
      admin.from("profiles").select("id", { count: "exact", head: true }).limit(1).then((r) => r.error ?? "ok"),
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

async function checkExternal(name: string, url: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) }).catch(() =>
      fetch(url, { method: "GET", signal: AbortSignal.timeout(3000) }),
    );
    const latencyMs = Date.now() - start;
    if (res.status >= 500) return { name, status: "error", latencyMs, message: `HTTP ${res.status}` };
    if (latencyMs > 2000) return { name, status: "warning", latencyMs, message: "Slow" };
    return { name, status: "active", latencyMs };
  } catch (err) {
    return { name, status: "error", latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "error" };
  }
}

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  const checks = await Promise.all([
    checkRedis(),
    checkSupabase(),
    checkExternal("CoinGecko", "https://api.coingecko.com/api/v3/ping"),
    checkExternal("DexScreener", "https://api.dexscreener.com"),
    checkExternal("Anthropic Claude", "https://api.anthropic.com"),
  ]);

  const errorCount = checks.filter((c) => c.status === "error").length;
  const degradedCount = checks.filter((c) => c.status === "warning").length;
  const overall: SummaryResponse["overall"] =
    errorCount > 0 ? "error" : degradedCount > 0 ? "warning" : "active";

  return NextResponse.json({
    overall,
    degradedCount,
    errorCount,
    checks,
    checkedAt: new Date().toISOString(),
  } satisfies SummaryResponse);
}
