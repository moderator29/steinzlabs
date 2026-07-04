'use client';

// Landing hero prompt — a live, animated "Ask the Chain anything" bar that
// types out real example questions and drops visitors straight into the
// product's signature AI surface. On-brand glass + aurora sheen. The homepage
// showing the platform as something you can TALK to is the fleet's top landing
// idea and the clearest "wtf, no other platform does this" first impression.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowUp } from 'lucide-react';

const EXAMPLES = [
  'Which tokens is smart money buying together right now?',
  'Show me the top whales by win rate',
  'What are the biggest whale moves today?',
  'Which whales are accumulating on Solana?',
  'Is this contract a honeypot?',
];

export function AskChainHero() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);
  const [focused, setFocused] = useState(false);

  // Typewriter cycling through example questions (pauses while the user types).
  useEffect(() => {
    if (value || focused) return;
    const target = EXAMPLES[exampleIdx];
    let i = 0;
    let raf: ReturnType<typeof setTimeout>;
    const type = () => {
      i += 1;
      setPlaceholder(target.slice(0, i));
      if (i < target.length) {
        raf = setTimeout(type, 38);
      } else {
        raf = setTimeout(() => setExampleIdx((n) => (n + 1) % EXAMPLES.length), 2200);
      }
    };
    raf = setTimeout(type, 200);
    return () => clearTimeout(raf);
  }, [exampleIdx, value, focused]);

  const go = () => {
    const q = value.trim();
    router.push(q ? `/dashboard/ask-chain?q=${encodeURIComponent(q)}` : '/dashboard/ask-chain');
  };

  return (
    <div className="mt-9 w-full max-w-[520px]">
      <div
        className="nl-glass relative overflow-hidden rounded-2xl p-2 flex items-center gap-2"
        style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 26px rgba(0,102,255,.20)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #00C8FF, transparent)', animation: 'nl-ai-sheen 3.2s ease-in-out infinite' }}
        />
        <span className="ps-2 shrink-0">
          <Sparkles className="w-4 h-4 text-[#00C8FF]" />
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
          placeholder={focused || value ? 'Ask the chain anything…' : (placeholder || 'Ask the chain anything…')}
          className="flex-1 bg-transparent px-1 py-2.5 text-sm focus:outline-none placeholder-slate-400 text-white"
          maxLength={200}
          aria-label="Ask the chain anything"
        />
        <button
          onClick={go}
          className="w-9 h-9 rounded-xl nl-btn-neon flex items-center justify-center shrink-0"
          aria-label="Ask the chain"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
      <p className="mt-2 text-[11px] text-center" style={{ color: 'var(--nl-text-muted,#8FA3FF)' }}>
        Natural language in, live on-chain answers out. No filters to learn.
      </p>
    </div>
  );
}

export default AskChainHero;
