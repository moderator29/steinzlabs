'use client';

import { useEffect, useState } from 'react';

// Simple client-side translate hook. Reads the current language from
// localStorage (set by LanguageSwitcher) and calls /api/translate.
// Cache is in-memory per session so the same string isn't re-translated
// across multiple consumers.

const LANG_KEY = 'naka_language';
const MEMO = new Map<string, string>();
const LISTENERS = new Set<() => void>();

export function getCurrentLang(): string {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem(LANG_KEY) || 'en';
}

export function setCurrentLang(lang: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANG_KEY, lang);
  LISTENERS.forEach((fn) => fn());
  window.dispatchEvent(new Event('naka_lang_change'));
}

export function subscribeLang(fn: () => void): () => void {
  LISTENERS.add(fn);
  return () => { LISTENERS.delete(fn); };
}

async function translate(text: string, target: string): Promise<string> {
  if (target === 'en' || !text) return text;
  const memoKey = `${target}|${text}`;
  const cached = MEMO.get(memoKey);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, target }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return text;
    const json = await res.json() as { translations?: string[] };
    const out = json.translations?.[0] ?? text;
    MEMO.set(memoKey, out);
    return out;
  } catch {
    return text;
  }
}

export function useTranslate(text: string): string {
  const [lang, setLang] = useState<string>('en');
  const [value, setValue] = useState<string>(text);

  useEffect(() => {
    setLang(getCurrentLang());
    const unsub = subscribeLang(() => setLang(getCurrentLang()));
    const onWin = () => setLang(getCurrentLang());
    window.addEventListener('naka_lang_change', onWin);
    return () => {
      unsub();
      window.removeEventListener('naka_lang_change', onWin);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (lang === 'en' || !text) { setValue(text); return; }
    translate(text, lang).then((r) => {
      if (!cancelled) setValue(r);
    });
    return () => { cancelled = true; };
  }, [lang, text]);

  return value;
}

// Batched version — useful when a component has many strings.
export function useTranslateMany(texts: string[]): string[] {
  const [lang, setLang] = useState<string>('en');
  const [values, setValues] = useState<string[]>(texts);

  useEffect(() => {
    setLang(getCurrentLang());
    const onWin = () => setLang(getCurrentLang());
    window.addEventListener('naka_lang_change', onWin);
    return () => window.removeEventListener('naka_lang_change', onWin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (lang === 'en') { setValues(texts); return; }
    const missing = texts.filter((t) => !MEMO.has(`${lang}|${t}`));
    if (missing.length === 0) {
      setValues(texts.map((t) => MEMO.get(`${lang}|${t}`) ?? t));
      return;
    }
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: missing, target: lang }),
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((json: { translations?: string[] } | null) => {
        if (!json?.translations) return;
        missing.forEach((m, i) => MEMO.set(`${lang}|${m}`, json.translations![i] ?? m));
        if (!cancelled) setValues(texts.map((t) => MEMO.get(`${lang}|${t}`) ?? t));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lang, texts]);

  return values;
}
