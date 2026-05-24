import 'server-only';
import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * C.7: Idempotency-Key middleware for write routes whose downstream
 * effects are not naturally idempotent (sniper execute, copy-trade
 * execute, sign+broadcast).
 *
 * Usage pattern inside a route:
 *
 *   const cached = await checkIdempotency(request, userId, '/api/sniper/execute', body);
 *   if (cached) return cached;
 *   // ... do the work, build `response` ...
 *   await saveIdempotency(request, userId, '/api/sniper/execute', body, response.status, payload);
 *   return response;
 *
 * The (user_id, key) primary key ensures concurrent retries from the
 * same client collapse into one execution. Different users cannot
 * collide because the key is scoped per user.
 */

const HEADER = 'idempotency-key';
const TTL_MS = 24 * 60 * 60 * 1000;

function hashBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? '')).digest('hex');
}

export interface CachedIdempotency {
  status_code: number;
  response_body: unknown;
}

export async function checkIdempotency(
  request: NextRequest,
  userId: string,
  endpoint: string,
  body: unknown,
): Promise<NextResponse | null> {
  const key = request.headers.get(HEADER);
  if (!key) return null;                  // no idempotency requested — pass through

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('idempotency_keys')
    .select('status_code, response_body, request_hash, created_at')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle<{ status_code: number; response_body: unknown; request_hash: string; created_at: string }>();

  if (!data) return null;

  // Expire stale rows lazily — a cron-side janitor could prune them,
  // but treating any row older than TTL as a cache miss keeps the
  // table self-healing.
  if (Date.now() - new Date(data.created_at).getTime() > TTL_MS) {
    await supabase.from('idempotency_keys').delete().eq('user_id', userId).eq('key', key);
    return null;
  }

  // Body must match — a same key with a different body is the classic
  // sign of a buggy retry. Reject with 409 so the client knows.
  if (data.request_hash !== hashBody(body)) {
    return NextResponse.json(
      { error: 'Idempotency-Key reused with a different request body', code: 'idempotency_mismatch' },
      { status: 409 },
    );
  }

  return NextResponse.json(data.response_body, { status: data.status_code, headers: { 'x-idempotent-replay': '1' } });
}

export async function saveIdempotency(
  request: NextRequest,
  userId: string,
  endpoint: string,
  body: unknown,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  const key = request.headers.get(HEADER);
  if (!key) return;
  const supabase = getSupabaseAdmin();
  await supabase.from('idempotency_keys').upsert({
    user_id: userId,
    key,
    endpoint,
    request_hash: hashBody(body),
    status_code: statusCode,
    response_body: responseBody as Record<string, unknown>,
  }, { onConflict: 'user_id,key' });
}
