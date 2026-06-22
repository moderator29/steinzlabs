'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Trophy } from 'lucide-react';

interface Conviction {
  id: string;
  asset: string;
  chain: string | null;
  direction: 'long' | 'short';
  thesis: string | null;
  status: 'open' | 'scored' | 'closed';
  score: number | null;
  created_at: string;
  author: { name: string; isChosen: boolean };
}

function DirBadge({ d }: { d: 'long' | 'short' }) {
  const long = d === 'long';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
      long ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
    }`}>
      {long ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{d}
    </span>
  );
}

export function ConvictionPanel() {
  const [board, setBoard] = useState<Conviction[]>([]);
  const [leaderboard, setLeaderboard] = useState<Conviction[]>([]);
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState('');
  const [chain, setChain] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [thesis, setThesis] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cult/conviction', { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const json = (await res.json()) as { board: Conviction[]; leaderboard: Conviction[] };
      setBoard(json.board);
      setLeaderboard(json.leaderboard);
      setError(null);
    } catch {
      setError('Could not reach the board.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = useCallback(async () => {
    if (!asset.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch('/api/cult/conviction', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ asset, chain, direction, thesis }),
      });
      if (res.status === 429) { setError('Slow down — convictions are weighed, not spammed.'); return; }
      if (!res.ok && res.status !== 201) throw new Error('post');
      setAsset(''); setChain(''); setThesis(''); setDirection('long');
      setError(null);
      await load();
    } catch {
      setError('Could not post your call.');
    } finally {
      setPosting(false);
    }
  }, [asset, chain, direction, thesis, posting, load]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      {/* Post + board */}
      <div className="space-y-4">
        <form
          className="rounded-2xl border border-white/10 bg-[#070A16]/80 p-4"
          onSubmit={(e) => { e.preventDefault(); post(); }}
        >
          <div className="flex flex-wrap gap-2">
            <input
              value={asset} onChange={(e) => setAsset(e.target.value)} maxLength={40}
              placeholder="Asset (e.g. $NAKA)" aria-label="Asset"
              className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-[#6B779C] focus:border-[#3D5AFE]/60 focus:outline-none"
            />
            <input
              value={chain} onChange={(e) => setChain(e.target.value)} maxLength={20}
              placeholder="Chain" aria-label="Chain"
              className="w-[110px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-[#6B779C] focus:border-[#3D5AFE]/60 focus:outline-none"
            />
            <div className="flex overflow-hidden rounded-lg border border-white/10">
              {(['long', 'short'] as const).map((d) => (
                <button
                  key={d} type="button" onClick={() => setDirection(d)}
                  aria-pressed={direction === d}
                  className={`px-3 py-2 text-[12px] font-bold uppercase ${
                    direction === d
                      ? (d === 'long' ? 'bg-emerald-500/25 text-emerald-200' : 'bg-rose-500/25 text-rose-200')
                      : 'bg-white/[0.03] text-[#8C9AC0]'
                  }`}
                >{d}</button>
              ))}
            </div>
          </div>
          <textarea
            value={thesis} onChange={(e) => setThesis(e.target.value)} maxLength={500} rows={2}
            placeholder="Your thesis (optional)" aria-label="Thesis"
            className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-[#6B779C] focus:border-[#3D5AFE]/60 focus:outline-none"
          />
          {error && <p className="mt-1 text-[12px] text-[#FF9DB0]">{error}</p>}
          <div className="mt-2 flex justify-end">
            <button
              type="submit" disabled={posting || !asset.trim()}
              className="rounded-lg bg-gradient-to-br from-[#3D5AFE] to-[#E11D48] px-5 py-2 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >{posting ? 'Posting…' : 'Post conviction'}</button>
          </div>
        </form>

        {loading ? (
          <p className="py-8 text-center text-sm text-[#8C9AC0]">Reading the board…</p>
        ) : board.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#8C9AC0]">No calls yet. Put your conviction on record.</p>
        ) : (
          <ul className="space-y-2">
            {board.map((c) => (
              <li key={c.id} className="rounded-xl border border-white/10 bg-[#070A16]/70 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{c.asset}</span>
                  <DirBadge d={c.direction} />
                  {c.chain && <span className="text-[11px] text-[#6B779C]">{c.chain}</span>}
                  {c.status === 'scored' && c.score != null && (
                    <span className="ml-auto text-[12px] font-bold text-[#FFD86B]">{c.score > 0 ? '+' : ''}{c.score}</span>
                  )}
                </div>
                {c.thesis && <p className="mt-1.5 text-[13px] leading-relaxed text-[#B4C0E0]">{c.thesis}</p>}
                <p className="mt-1.5 text-[11px] text-[#6B779C]">
                  {c.author.isChosen && '◈ '}{c.author.name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Leaderboard */}
      <aside className="rounded-2xl border border-white/10 bg-[#070A16]/80 p-4 lg:sticky lg:top-4 lg:self-start">
        <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[#FFD86B]">
          <Trophy size={15} /> Top convictions
        </h3>
        {leaderboard.length === 0 ? (
          <p className="text-[12px] text-[#6B779C]">No scored calls yet. The leaderboard fills as calls resolve.</p>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="w-5 text-[12px] font-bold text-[#6B779C]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">{c.asset}</p>
                  <p className="truncate text-[11px] text-[#8C9AC0]">{c.author.name}</p>
                </div>
                <span className="text-[13px] font-bold text-[#FFD86B]">{c.score != null ? (c.score > 0 ? '+' : '') + c.score : '—'}</span>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
