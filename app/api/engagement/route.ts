import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

export const runtime = 'nodejs';

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

    if (action === 'unlike') {
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
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
