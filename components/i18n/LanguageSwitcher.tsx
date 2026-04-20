'use client';

import { useEffect, useState, useRef } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { getCurrentLang, setCurrentLang } from '@/lib/i18n/useTranslate';

interface Lang {
  code: string;
  label: string;
  native: string;
  flag: string;
}

export const LANGUAGES: Lang[] = [
  { code: 'en',    label: 'English',    native: 'English',    flag: '\uD83C\uDDFA\uD83C\uDDF8' },
  { code: 'es',    label: 'Spanish',    native: 'Español',    flag: '\uD83C\uDDEA\uD83C\uDDF8' },
  { code: 'fr',    label: 'French',     native: 'Français',   flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'pt',    label: 'Portuguese', native: 'Português',  flag: '\uD83C\uDDF5\uD83C\uDDF9' },
  { code: 'de',    label: 'German',     native: 'Deutsch',    flag: '\uD83C\uDDE9\uD83C\uDDEA' },
  { code: 'it',    label: 'Italian',    native: 'Italiano',   flag: '\uD83C\uDDEE\uD83C\uDDF9' },
  { code: 'ru',    label: 'Russian',    native: 'Русский',    flag: '\uD83C\uDDF7\uD83C\uDDFA' },
  { code: 'zh-cn', label: 'Chinese',    native: '中文',         flag: '\uD83C\uDDE8\uD83C\uDDF3' },
  { code: 'ja',    label: 'Japanese',   native: '日本語',        flag: '\uD83C\uDDEF\uD83C\uDDF5' },
  { code: 'ko',    label: 'Korean',     native: '한국어',         flag: '\uD83C\uDDF0\uD83C\uDDF7' },
  { code: 'ar',    label: 'Arabic',     native: 'العربية',      flag: '\uD83C\uDDF8\uD83C\uDDE6' },
  { code: 'hi',    label: 'Hindi',      native: 'हिन्दी',          flag: '\uD83C\uDDEE\uD83C\uDDF3' },
  { code: 'tr',    label: 'Turkish',    native: 'Türkçe',      flag: '\uD83C\uDDF9\uD83C\uDDF7' },
  { code: 'vi',    label: 'Vietnamese', native: 'Tiếng Việt',  flag: '\uD83C\uDDFB\uD83C\uDDF3' },
  { code: 'id',    label: 'Indonesian', native: 'Indonesia',   flag: '\uD83C\uDDEE\uD83C\uDDE9' },
];

interface Props {
  variant?: 'nav' | 'compact';
}

export function LanguageSwitcher({ variant = 'nav' }: Props) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<string>('en');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setLang(getCurrentLang()); }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  function choose(l: Lang) {
    setLang(l.code);
    setCurrentLang(l.code);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={
          variant === 'compact'
            ? 'flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors'
            : 'flex items-center gap-2 text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg px-3 py-1.5 transition-all'
        }
        aria-label="Language"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{current.native}</span>
        <span className="sm:hidden">{current.code.toUpperCase()}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 max-h-[320px] overflow-y-auto bg-[#0e1220] border border-white/[0.08] rounded-xl shadow-2xl z-[60] p-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => choose(l)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                l.code === lang ? 'bg-[#0A1EFF]/15 text-white' : 'text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{l.native}</div>
                <div className="text-[10px] text-gray-500">{l.label}</div>
              </div>
              {l.code === lang && <Check className="w-3.5 h-3.5 text-[#4D6BFF]" />}
            </button>
          ))}
          <div className="mt-1 px-3 py-2 border-t border-white/[0.05] text-[10px] text-gray-500">
            Auto-translated by Naka Labs. Page strings switch live as you change language.
          </div>
        </div>
      )}
    </div>
  );
}

// Tiny wrapper that translates its children text at render time.
// Use like <T>Open App</T> and it picks up the current language.
export function T({ children }: { children: string }) {
  // Avoid importing useTranslate from this file to prevent a provider
  // loop — inline a minimal version here.
  const [value, setValue] = useState(children);
  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      const lang = getCurrentLang();
      if (lang === 'en' || !children) { setValue(children); return; }
      try {
        const res = await fetch(`/api/translate?q=${encodeURIComponent(children)}&tl=${lang}`);
        if (!res.ok) return;
        const json = await res.json() as { translated?: string };
        if (!cancelled) setValue(json.translated ?? children);
      } catch { /* noop */ }
    };
    update();
    const on = () => update();
    window.addEventListener('naka_lang_change', on);
    return () => { cancelled = true; window.removeEventListener('naka_lang_change', on); };
  }, [children]);
  return <>{value}</>;
}
