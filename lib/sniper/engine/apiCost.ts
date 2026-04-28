/**
 * Lightweight paid-API call logger for the sniper engine.
 *
 * Writes one row per outbound paid call to public.api_cost_log so the team can
 * monitor spend per provider per chain. Failures here never throw — observability
 * must not break execution.
 */

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SniperChain } from "../chains";

export type ApiProvider =
  | "jupiter"
  | "jito"
  | "helius"
  | "0x"
  | "flashbots"
  | "bloxroute"
  | "alchemy"
  | "ton-center"
  | "stonfi";

export interface ApiCostEntry {
  provider: ApiProvider;
  chain: SniperChain;
  endpoint: string;
  ok: boolean;
  durationMs: number;
  userId?: string | null;
  criteriaId?: string | null;
  status?: number | null;
  errorMsg?: string | null;
}

export async function logApiCost(entry: ApiCostEntry): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("api_cost_log").insert({
      provider: entry.provider,
      chain: entry.chain,
      endpoint: entry.endpoint,
      ok: entry.ok,
      duration_ms: entry.durationMs,
      user_id: entry.userId ?? null,
      criteria_id: entry.criteriaId ?? null,
      http_status: entry.status ?? null,
      error_msg: entry.errorMsg ?? null,
    });
  } catch {
    // Swallowed by design — logger must never affect trade flow.
  }
}

export async function timed<T>(
  meta: Omit<ApiCostEntry, "ok" | "durationMs" | "status" | "errorMsg">,
  fn: () => Promise<{ result: T; status?: number }>,
): Promise<T> {
  const t0 = Date.now();
  try {
    const { result, status } = await fn();
    void logApiCost({ ...meta, ok: true, durationMs: Date.now() - t0, status: status ?? null });
    return result;
  } catch (err: any) {
    void logApiCost({
      ...meta,
      ok: false,
      durationMs: Date.now() - t0,
      errorMsg: err?.message ?? String(err),
    });
    throw err;
  }
}
