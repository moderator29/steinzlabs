import 'server-only';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §5 Dune Analytics client. LOCKED env var: DUNE_API_KEY (per
 * SESSION-T-KICKOFF §0.5 + steinz_labs_dune_sim_env_names memory).
 * Plan also LOCKED to DUNE_PLAN — values: free | analyst | plus.
 *
 * Endpoint base: https://api.dune.com/api/v1
 * Docs: https://docs.dune.com/api-reference/
 *
 * Pricing (§5.7):
 *   free:      2,500 credits / month
 *   analyst:  25,000 credits / month  ($399)
 *   plus:    100,000 credits / month  ($999)
 *
 * Every executed query costs credits. Cached reads cost zero.
 */

const BASE = 'https://api.dune.com/api/v1';

const PLAN_CAPS: Record<string, number> = {
  free: 2_500,
  analyst: 25_000,
  plus: 100_000,
  enterprise: 1_000_000,
};

function plan(): keyof typeof PLAN_CAPS {
  const p = (process.env.DUNE_PLAN ?? 'free').toLowerCase();
  return (p in PLAN_CAPS ? p : 'free') as keyof typeof PLAN_CAPS;
}

export function isDuneConfigured(): boolean {
  return Boolean(process.env.DUNE_API_KEY);
}

function hashParams(params: Record<string, unknown>): string {
  const norm = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 32);
}

async function fetchDune<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
  const key = process.env.DUNE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'X-Dune-API-Key': key,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Budget tracking (§5.7) ──────────────────────────────────────────────

async function incrementBudget(creditsUsed: number): Promise<void> {
  const admin = getSupabaseAdmin();
  const month = new Date().toISOString().slice(0, 7) + '-01';   // YYYY-MM-01
  const cap = PLAN_CAPS[plan()];
  // Upsert: insert with current usage OR add to existing.
  await admin.rpc('dune_budget_increment', { p_month: month, p_plan: plan(), p_cap: cap, p_credits: creditsUsed }).then(
    () => {},
    async () => {
      // Fallback when the RPC isn't defined yet: do read-modify-write.
      const { data: row } = await admin.from('dune_budget').select('credits_used, queries_used').eq('month', month).maybeSingle();
      if (row) {
        await admin.from('dune_budget').update({
          credits_used: (row.credits_used ?? 0) + creditsUsed,
          queries_used: (row.queries_used ?? 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('month', month);
      } else {
        await admin.from('dune_budget').insert({
          month,
          plan: plan(),
          credit_cap: cap,
          credits_used: creditsUsed,
          queries_used: 1,
        });
      }
    },
  );
}

/**
 * Returns a 0-1 utilization ratio for the current month + a hard-block
 * flag (>=95% used). Callers should refuse new queries when blocked.
 */
export async function getBudgetStatus(): Promise<{
  used: number;
  cap: number;
  utilization: number;
  block: boolean;
  warn: boolean;
}> {
  const admin = getSupabaseAdmin();
  const month = new Date().toISOString().slice(0, 7) + '-01';
  const cap = PLAN_CAPS[plan()];
  const { data: row } = await admin.from('dune_budget').select('credits_used').eq('month', month).maybeSingle<{ credits_used: number }>();
  const used = row?.credits_used ?? 0;
  const utilization = cap > 0 ? used / cap : 1;
  return { used, cap, utilization, block: utilization >= 0.95, warn: utilization >= 0.80 };
}

// ─── Query execution ────────────────────────────────────────────────────

interface ExecutionResponse { execution_id?: string }
interface ResultResponse {
  state?: string;        // EXECUTING | COMPLETED | FAILED | ...
  result?: { rows?: unknown[]; metadata?: Record<string, unknown> };
}

export interface DuneRunOptions {
  query_id: string | number;
  parameters?: Record<string, unknown>;
  ttl_seconds?: number;      // cache TTL; default 24h
  cost_credits?: number;     // estimated credit cost (used for budget tracking)
}

/**
 * Run a Dune query with our caching + budget governance.
 *
 * Returns:
 *   { ok: true, rows, freshness: 'live' | 'cached' | 'stale' }
 *   { ok: false, reason: 'budget_blocked' | 'unconfigured' | 'execute_failed' }
 *
 * Failure ladder (§5.8) lives in lib/dune/failureLadder.ts on top of
 * this function — that module decides what to do with each outcome.
 */
export async function runDuneQuery(opts: DuneRunOptions): Promise<{
  ok: true;
  rows: unknown[];
  freshness: 'live' | 'cached' | 'stale';
  fetched_at: string;
} | {
  ok: false;
  reason: string;
}> {
  if (!isDuneConfigured()) return { ok: false, reason: 'unconfigured' };

  const queryId = String(opts.query_id);
  const params = opts.parameters ?? {};
  const ttl = opts.ttl_seconds ?? 24 * 3600;
  const cost = opts.cost_credits ?? 10;
  const paramsHash = hashParams(params);

  const admin = getSupabaseAdmin();

  // Cache check.
  const { data: cached } = await admin
    .from('dune_cache')
    .select('payload, fetched_at')
    .eq('query_id', queryId)
    .eq('params_hash', paramsHash)
    .maybeSingle<{ payload: { rows?: unknown[] }; fetched_at: string }>();

  if (cached) {
    const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
    if (ageMs < ttl * 1000) {
      return {
        ok: true,
        rows: cached.payload?.rows ?? [],
        freshness: 'cached',
        fetched_at: cached.fetched_at,
      };
    }
    // Cache stale — we may still serve it on failure (handled by callers).
  }

  // Budget gate.
  const budget = await getBudgetStatus();
  if (budget.block) {
    if (cached) {
      return {
        ok: true,
        rows: cached.payload?.rows ?? [],
        freshness: 'stale',
        fetched_at: cached.fetched_at,
      };
    }
    return { ok: false, reason: 'budget_blocked' };
  }

  // Execute live.
  const exec = await fetchDune<ExecutionResponse>(`/query/${queryId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ query_parameters: params }),
  });
  if (!exec?.execution_id) {
    if (cached) {
      return {
        ok: true,
        rows: cached.payload?.rows ?? [],
        freshness: 'stale',
        fetched_at: cached.fetched_at,
      };
    }
    return { ok: false, reason: 'execute_failed' };
  }

  // Poll for completion. Dune queries can take seconds-to-minutes; cap
  // the wait at ~25s here (we already have a 20s per-call timeout). The
  // caller can re-poll with /api/dune/result/[execution_id] if longer.
  const deadline = Date.now() + 25_000;
  let result: ResultResponse | null = null;
  while (Date.now() < deadline) {
    result = await fetchDune<ResultResponse>(`/execution/${exec.execution_id}/results`);
    if (result?.state === 'QUERY_STATE_COMPLETED') break;
    if (result?.state === 'QUERY_STATE_FAILED') {
      if (cached) {
        return {
          ok: true,
          rows: cached.payload?.rows ?? [],
          freshness: 'stale',
          fetched_at: cached.fetched_at,
        };
      }
      return { ok: false, reason: 'query_failed' };
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  if (!result || !result.result) {
    if (cached) {
      return {
        ok: true,
        rows: cached.payload?.rows ?? [],
        freshness: 'stale',
        fetched_at: cached.fetched_at,
      };
    }
    return { ok: false, reason: 'timeout' };
  }

  const rows = result.result.rows ?? [];

  // Write cache + budget side-effect (fire-and-forget).
  void admin.from('dune_cache').upsert({
    query_id: queryId,
    params_hash: paramsHash,
    payload: { rows },
    credits_used: cost,
    ttl_seconds: ttl,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'query_id,params_hash' });
  void incrementBudget(cost);

  return { ok: true, rows, freshness: 'live', fetched_at: new Date().toISOString() };
}

// ─── Convenience wrappers for the materialized tables ───────────────────

export async function readHolderConcentration(token: string, chain: string): Promise<Record<string, unknown> | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('dune_holder_concentration')
    .select('*')
    .eq('token_address', token)
    .eq('chain', chain)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export async function readSmartMoneyScore(wallet: string, chain: string): Promise<Record<string, unknown> | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('dune_smart_money_score')
    .select('*')
    .eq('wallet_address', wallet)
    .eq('chain', chain)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export async function topSmartMoney(chain: string, limit = 200): Promise<Array<Record<string, unknown>>> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('dune_smart_money_score')
    .select('*')
    .eq('chain', chain)
    .order('score', { ascending: false })
    .limit(limit);
  return (data as Array<Record<string, unknown>> | null) ?? [];
}
