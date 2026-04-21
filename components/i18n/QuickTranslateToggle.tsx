'use client';

import { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';
import { getCurrentLang, setCurrentLang } from '@/lib/i18n/useTranslate';

const LAST_KEY = 'naka_last_nonEn_lang';

// One-tap EN ↔ last-used language. Companion to the full dropdown.
// When you're in EN and tap, it switches to your last non-EN pick
// (defaults to 'es' if you've never chosen one). When you're in any
// non-EN language, tap flips straight back to EN.
export function QuickTranslateToggle({ className = '' }: { className?: string }) {
  const [lang, setLang] = useState<string>('en');
  const [lastNonEn, setLastNonEn] = useState<string>('es');

  useEffect(() => {
    setLang(getCurrentLang());
    const stored = localStorage.getItem(LAST_KEY);
    if (stored && stored !== 'en') setLastNonEn(stored);
    const onChange = () => {
      const cur = getCurrentLang();
      setLang(cur);
      if (cur !== 'en') {
        localStorage.setItem(LAST_KEY, cur);
        setLastNonEn(cur);
      }
    };
    window.addEventListener('naka_lang_change', onChange);
    return () => window.removeEventListener('naka_lang_change', onChange);
  }, []);

  const target = lang === 'en' ? lastNonEn : 'en';
  const label = target.toUpperCase();

  return (
    <button
      type="button"
      onClick={() => setCurrentLang(target)}
      title={lang === 'en' ? `Translate to ${label}` : `Back to English`}
      aria-label={lang === 'en' ? `Translate to ${label}` : `Back to English`}
      className={`inline-flex items-center gap-1 w-auto h-9 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[10px] font-semibold text-white/70 hover:text-white transition-colors ${className}`}
      data-no-translate
    >
      <Languages className="w-3.5 h-3.5" />
      <span className="tabular-nums">{label}</span>
    </button>
  );
}
