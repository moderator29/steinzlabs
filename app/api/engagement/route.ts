import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { takeToken } from '@/lib/cache/upstash-rate-limit';

export const runtime = 'nodejs';

// Per-IP flood guard. This endpoint is anonymous (view events need no auth),
// so a single client can otherwise hammer it without limit: on 2026-07-10 one
// IP sent 1,063 requests in 5 minutes, each triggering a Supabase insert plus a
// full re-aggregation, spiking Vercel function invocations. We check the limit
// BEFORE touching Supabase so a flood is rejected cheaply. Upstash-backed so the
// window is shared across all lambda instances (an in-memory bucket resets on
// every cold start a burst spins up). Fails open if Redis is unset. A real feed
// session fires only a handful of events, so 80/min per IP never bites genuine
// use while it crushes an abusive loop.
function clientIp(req: NextRequest): string {
  const h = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '';
  return h.split(',')[0]?.trim() || 'unknown';
}
async function floodOk(req: NextRequest): Promise<boolean> {
  return takeToken(`engage:${clientIp(req)}`, { capacity: 80, refillSec: 60 });
}
const TOO_MANY = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

type CountShape = { views: number; likes: number; shares: number; comments: number };

const ZERO: CountShape = { views: 0, likes: 0, shares: 0, comments: 0 };

const PostBody = z.object({
  eventId: z.string().min(1).max(128),
  action: z.enum(['view', 'like', 'unlike', 'share']),
});

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
}

async function aggregateCounts(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  eventId: string,
): Promise<CountShape> {
  const { data, error } = await supabase
    .from('context_feed_engagement')
    .select('action')
    .eq('event_id', eventId);
  if (error) throw error;
  const out: CountShape = { ...ZERO };
  for (const row of data ?? []) {
    const a = (row as { action: string }).action;
    if (a === 'view') out.views += 1;
    else if (a === 'like') out.likes += 1;
    else if (a === 'share') out.shares += 1;
    else if (a === 'comment') out.comments += 1;
  }
  return out;
}

export async function POST(request: NextRequest) {
  if (!(await floodOk(request))) return TOO_MANY;
  try {
    const parsed = PostBody.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { eventId, action } = parsed.data;

    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    // VIEWS are a low-stakes liveness counter and may be recorded anonymously
    // (the RLS insert policy already permits a null user_id). LIKES / SHARES /
    // UNLIKE stay authenticated so they cannot be inflated and dedupe per user
    // via the (event_id, user_id, action) unique index (NULL never dedupes).
    if (action !== 'view' && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'unlike') {
      const { error } = await supabase
        .from('context_feed_engagement')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .eq('action', 'like');
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('context_feed_engagement')
        .insert({ event_id: eventId, user_id: userId, action });
      if (error && error.code !== '23505') {
        throw error;
      }
    }

    const counts = await aggregateCounts(supabase, eventId);
    return NextResponse.json(counts);
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'engagement.POST' } });
    return NextResponse.json(ZERO, { status: 200 });
  }
}

export async function GET(request: NextRequest) {
  if (!(await floodOk(request))) return TOO_MANY;
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  if (!eventId || eventId.length > 128) {
    return NextResponse.json(ZERO);
  }
  try {
    const supabase = await getSupabase();
    const counts = await aggregateCounts(supabase, eventId);
    return NextResponse.json(counts);
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'engagement.GET' } });
    return NextResponse.json(ZERO);
  }
}
