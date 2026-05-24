import 'server-only';
import { NextResponse } from 'next/server';

interface GameScore {
  id: string;
  username: string;
  score: number;
  coins: number;
  distance: number;
  timestamp: number;
  gamesPlayed: number;
  bestStreak: number;
}

const scores: Map<string, GameScore> = new Map();

export async function GET() {
  const all = Array.from(scores.values()).sort((a, b) => b.score - a.score);
  return NextResponse.json({
    leaderboard: all.slice(0, 50),
    totalPlayers: all.length,
    totalGamesPlayed: all.reduce((s, p) => s + p.gamesPlayed, 0),
    highestScore: all[0]?.score || 0,
    topPlayer: all[0]?.username || 'N/A',
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, score, coins, distance } = body;

    if (!username || typeof score !== 'number') {
      return NextResponse.json({ error: 'Username and score required' }, { status: 400 });
    }

    const cleanName = username.trim().slice(0, 20);
    const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const existing = scores.get(id);
    if (existing) {
      existing.gamesPlayed += 1;
      if (score > existing.score) {
        existing.score = score;
        existing.coins = coins || 0;
        existing.distance = distance || 0;
        existing.timestamp = Date.now();
      }
      if ((distance || 0) > existing.bestStreak) {
        existing.bestStreak = distance || 0;
      }
    } else {
      scores.set(id, {
        id,
        username: cleanName,
        score,
        coins: coins || 0,
        distance: distance || 0,
        timestamp: Date.now(),
        gamesPlayed: 1,
        bestStreak: distance || 0,
      });
    }

    const all = Array.from(scores.values()).sort((a, b) => b.score - a.score);
    const rank = all.findIndex(s => s.id === id) + 1;

    return NextResponse.json({
      rank,
      totalPlayers: all.length,
      personalBest: scores.get(id)!.score,
      gamesPlayed: scores.get(id)!.gamesPlayed,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  // Admin-only — requires Authorization: Bearer <ADMIN_BEARER_TOKEN>.
  // Previously this accepted ?password=<hardcoded plaintext> as a query
  // param, which leaked the secret in URLs, logs, browser history, and
  // referer headers. Removed entirely in favour of header-based auth.
  const expected = process.env.ADMIN_BEARER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'Admin auth not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    scores.delete(id);
  } else {
    scores.clear();
  }
  return NextResponse.json({ success: true });
}
