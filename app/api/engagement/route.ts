import { NextResponse } from 'next/server';

const engagementStore: Record<string, { views: number; likes: number; shares: number; comments: number }> = {};
const userActions: Set<string> = new Set();

function getEngagement(eventId: string) {
  if (!engagementStore[eventId]) {
    engagementStore[eventId] = {
      views: 0,
      likes: 0,
      shares: 0,
      comments: 0,
    };
  }
  return engagementStore[eventId];
}

export async function POST(request: Request) {
  try {
    const { eventId, action, userId } = await request.json();

    if (!eventId || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const engagement = getEngagement(eventId);
    const actionKey = `${eventId}:${userId || 'anon'}:${action}`;

    if (action === 'view') {
      if (!userActions.has(actionKey)) {
        engagement.views += 1;
        userActions.add(actionKey);
      }
    } else if (action === 'like') {
      if (!userActions.has(actionKey)) {
        engagement.likes += 1;
        userActions.add(actionKey);
      }
    } else if (action === 'unlike') {
      const likeKey = `${eventId}:${userId || 'anon'}:like`;
      if (userActions.has(likeKey)) {
        engagement.likes = Math.max(0, engagement.likes - 1);
        userActions.delete(likeKey);
      }
    } else if (action === 'share') {
      engagement.shares += 1;
      userActions.add(actionKey);
    }

    return NextResponse.json(engagement);
  } catch (error) {

    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ views: 0, likes: 0, shares: 0, comments: 0 });
  }

  const engagement = getEngagement(eventId);
  return NextResponse.json(engagement);
}
