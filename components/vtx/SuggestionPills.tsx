'use client';

/**
 * SuggestionPills — renders the 3 follow-up suggestions the server
 * emits in the 'done' event (audit B.5 P1). Staggered fade-in at
 * 50ms intervals so the pills feel like a thought arriving, not
 * a layout shift.
 */

import { ChevronRight } from 'lucide-react';

export interface SuggestionPillsProps {
  suggestions: string[];
  onPick: (suggestion: string) => void;
}

export function SuggestionPills({ suggestions, onPick }: SuggestionPillsProps) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {suggestions.slice(0, 4).map((s, i) => (
        <button
          key={`${s}-${i}`}
          onClick={() => onPick(s)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full nl-glass hover:border-[#0066FF]/40 hover:bg-[#0066FF]/[0.08] text-[12px] text-slate-200 hover:text-white transition-all"
          style={{
            animation: `naka-pill-in 280ms cubic-bezier(0.22,1,0.36,1) backwards`,
            animationDelay: `${i * 50}ms`,
          }}
        >
          {s}
          <ChevronRight className="w-3 h-3 opacity-60" />
        </button>
      ))}
      <style jsx>{`
        @keyframes naka-pill-in {
          from { opacity: 0; transform: translateY(4px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          button { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
