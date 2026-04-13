'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { locales, localeNames, type Locale } from '@/i18n';

const LOCALE_KEY = 'steinz_locale';

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && (locales as readonly string[]).includes(stored)) return stored as Locale;
  } catch { /* ignore */ }
  return 'en';
}

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

export function LanguageSwitcher({ compact = false, className = '' }: LanguageSwitcherProps) {
  const [current, setCurrent] = useState<Locale>('en');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(getStoredLocale());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = useCallback((locale: Locale) => {
    setCurrent(locale);
    setOpen(false);
    try {
      localStorage.setItem(LOCALE_KEY, locale);
    } catch { /* ignore */ }

    // Apply RTL for Arabic
    document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', locale);

    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('localeChange', { detail: { locale } }));
  }, []);

  const currentName = localeNames[current];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1E2433] bg-[#141824] hover:border-[#2E3443] hover:bg-[#1E2433] transition-all text-gray-300 hover:text-white"
        aria-label="Select language"
        aria-expanded={open}
      >
        <Globe className="w-3.5 h-3.5 text-gray-400" />
        {!compact && <span className="text-xs font-medium">{currentName}</span>}
        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#141824] border border-[#1E2433] rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-1.5 max-h-72 overflow-y-auto">
            {locales.map(locale => (
              <button
                key={locale}
                onClick={() => handleSelect(locale)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  current === locale
                    ? 'bg-[#0A1EFF]/15 text-[#0A1EFF]'
                    : 'text-gray-300 hover:bg-[#1E2433] hover:text-white'
                }`}
              >
                <span className="flex-1 text-xs font-medium">{localeNames[locale]}</span>
                <span className="text-[10px] font-mono text-gray-600 uppercase">{locale}</span>
                {current === locale && <Check className="w-3 h-3 text-[#0A1EFF] flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
