'use client';

// Ask the Chain — type any on-chain question in plain English, get a real
// answer over live Naka data. Claude maps the question to a safe structured
// query (never raw SQL); the server runs it over allowlisted public tables;
// Claude narrates the actual rows. The signature "data hub you can talk to".

import { useEffect, useState } from 'react';
import { Sparkles, ArrowUp, Loader2 } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { AiInsightCard } from '@/components/ai/AiInsightCard';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { askChainHowItWorks } from '@/lib/howItWorks/content/ask-chain';

interface AskResult {
  answer: string;
  capability?: string;
  columns: string[];
  rows: Record<string, string | number | boolean | null>[];
}

const SUGGESTIONS = [
  'Which tokens is smart money converging on right now?',
  'Show me the top whales by win rate',
  'Biggest whale buys in the last 24 hours',
  'Which whales are buying WETH?',
  'Top accumulator whales on Solana',
];

function fmtCell(v: string | number | boolean | null, col: string): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    if (/usd|value|pnl/i.test(col)) return v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`;
    if (/rate|score/i.test(col)) return `${Math.round(v)}${/rate/i.test(col) ? '%' : ''}`;
    return String(v);
  }
  return String(v);
}

export default function AskChainPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-run a question arriving from the landing hero prompt (?q=…). Read from
  // window to avoid the useSearchParams Suspense requirement.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q');
      if (q && q.trim()) { setQuestion(q); ask(q); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ask-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ask the Chain is unavailable');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white max-w-3xl mx-auto px-4 pt-4 pb-28">
      <div className="flex items-center gap-2 mb-6">
        <BackButton href="/dashboard" compact />
        <span className="text-white font-semibold">Ask the Chain</span>
        <HowItWorksButton content={askChainHowItWorks} className="ms-auto shrink-0" />
      </div>

      {/* Hero prompt */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0066FF]/15 border border-[#0066FF]/30 mb-3">
          <Sparkles className="w-7 h-7 text-[#00C8FF]" />
        </div>
        <h1 className="text-2xl font-bold text-white">Ask the on-chain economy anything</h1>
        <p className="text-slate-400 text-sm mt-1">Plain English in, real live data out. No filters to learn.</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(question); }}
        className="nl-glass rounded-2xl p-2 flex items-center gap-2 mb-3"
        style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 22px rgba(0,102,255,.16)' }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. which tokens is smart money buying together?"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm focus:outline-none placeholder-slate-500 text-white"
          maxLength={400}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="w-10 h-10 rounded-xl nl-btn-neon flex items-center justify-center disabled:opacity-40 shrink-0"
          aria-label="Ask"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
        </button>
      </form>

      {!result && !loading && (
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setQuestion(s); ask(s); }}
              className="px-3 py-1.5 rounded-full text-xs text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:border-[#0066FF]/40 hover:text-white transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="nl-glass rounded-2xl p-4 text-center text-amber-300 text-sm">{error}</div>
      )}

      {(loading || result) && (
        <div className="space-y-4">
          <AiInsightCard
            title="VTX answer"
            text={result?.answer ?? ''}
            streaming={!!result?.answer}
            loading={loading}
          />

          {result && result.rows.length > 0 && (
            <div className="nl-glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-white/[0.06]">
                      {result.columns.map((c) => (
                        <th key={c} className="text-start font-semibold px-3 py-2 whitespace-nowrap">{c.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {result.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        {result.columns.map((c) => (
                          <td key={c} className="px-3 py-2 text-slate-200 whitespace-nowrap tabular-nums">{fmtCell(row[c], c)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
