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
        existing.character = character || existing.character;
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
  const { searchParams } = new URL(req.url);
  const password = searchParams.get('password');
  if (password !== '195656') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = searchParams.get('id');
  if (id) {
    scores.delete(id);
  } else {
    scores.clear();
  }
  return NextResponse.json({ success: true });
}
