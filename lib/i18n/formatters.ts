'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

/**
 * Locale-aware number / currency / date / percent formatters.
 *
 * Replaces ad-hoc `n.toLocaleString('en-US', …)` calls so European
 * users see `1.234,56` and Arabic users see RTL-safe digits without
 * us hardcoding `'en-US'` at every call site.
 */
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
