'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

/**
 * Locale-aware number / currency / date / percent formatters.
 *
 * Two surfaces coexist here:
 *
 *  1. Imperative singleton (`setLocale` / `getLocale` / `formatNumber` /
 *     `formatCurrency` / `formatPercent`) — driven by
 *     `lib/i18n/useTranslate` when the user switches language via
 *     `LanguageSwitcher`. Used by call sites outside of a next-intl tree
 *     (server routes, plain string helpers, classic components).
 *
 *  2. Next-intl hook (`useFormatters`) — returns a memo'd `Formatters`
 *     bundle keyed off the route locale. Use this in components that
 *     already sit under a `NextIntlClientProvider`.
 *
 * Both honour the same goal: stop hardcoding `'en-US'` so European users
 * see `1.234,56` and Arabic users get RTL-safe digits.
 */

// ─── Imperative singleton ────────────────────────────────────────────────

let cachedLocale: string | null = null;

export function setLocale(locale: string): void {
  cachedLocale = locale;
}

export function getLocale(): string {
  if (cachedLocale) return cachedLocale;
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('naka_language');
      if (stored) {
        cachedLocale = stored;
        return stored;
      }
    } catch {
      /* localStorage blocked — fall through to navigator */
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      cachedLocale = navigator.language;
      return navigator.language;
    }
  }
  return 'en-US';
}

/** Locale-aware number formatting. Default fraction digits unbounded. */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale?: string,
): string {
  return value.toLocaleString(locale ?? getLocale(), options);
}

/** USD by default; pass {currency: 'EUR'} etc. to override. */
export function formatCurrency(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale?: string,
): string {
  return value.toLocaleString(locale ?? getLocale(), {
    style: 'currency',
    currency: 'USD',
    ...options,
  });
}

/** Percent (input is a 0–1 ratio; 0.05 → "5%"). */
export function formatPercent(
  ratio: number,
  options: Intl.NumberFormatOptions = {},
  locale?: string,
): string {
  return ratio.toLocaleString(locale ?? getLocale(), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  });
}

// ─── Next-intl hook surface ──────────────────────────────────────────────

export type Formatters = ReturnType<typeof formatters>;

export function formatters(locale: string) {
  const num = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 });
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  const dateLong = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
  const dateShort = new Intl.DateTimeFormat(locale, { dateStyle: 'short' });
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' });
  return {
    locale,
    number: (n: number) => num.format(n),
    compact: (n: number) => compact.format(n),
    currency: (n: number) => currency.format(n),
    percent: (n: number) => percent.format(n),
    date: (d: Date | string | number) => dateLong.format(new Date(d)),
    dateShort: (d: Date | string | number) => dateShort.format(new Date(d)),
    time: (d: Date | string | number) => time.format(new Date(d)),
  };
}

export function useFormatters(): Formatters {
  const locale = useLocale();
  return useMemo(() => formatters(locale), [locale]);
}
