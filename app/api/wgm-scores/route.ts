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
  character: string;
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
    const { username, score, coins, distance, character } = body;

    // typeof NaN/Infinity is 'number', so the old guard let a client post
    // score: Infinity / NaN and corrupt sort order + Math.max forever.
    if (!username || !Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: 'Username and a valid score required' }, { status: 400 });
    }
    const safeCoins = Number.isFinite(coins) && coins >= 0 ? coins : 0;
    const safeDistance = Number.isFinite(distance) && distance >= 0 ? distance : 0;

    const cleanName = username.trim().slice(0, 20);
    const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const existing = scores.get(id);
    if (existing) {
      existing.gamesPlayed += 1;
      if (score > existing.score) {
        existing.score = score;
        existing.coins = safeCoins;
        existing.distance = safeDistance;
        existing.timestamp = Date.now();
        existing.character = character || existing.character;
      }
      if (safeDistance > existing.bestStreak) {
        existing.bestStreak = safeDistance;
      }
    } else {
      scores.set(id, {
        id,
        username: cleanName,
        score,
        coins: safeCoins,
        distance: safeDistance,
        timestamp: Date.now(),
        gamesPlayed: 1,
        bestStreak: safeDistance,
        character: character || 'cyber-warrior',
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
  // Was gated by a hardcoded password ('195656') committed in source, so
  // anyone who read the bundle/repo could wipe the leaderboard.
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
