/**
 * Locale-aware number / currency / percent formatters.
 *
 * The audit (Agent 14, §3) flagged 121 `.toLocaleString()` calls that
 * implicitly used the browser locale OR hardcoded 'en-US'. This module is
 * the canonical surface for all new formatting work — it reads the user's
 * chosen locale from the same source AutoTranslate uses
 * (`localStorage.naka_language` client-side, `Accept-Language` fallback on
 * server-side via the `setLocale` injection point) so platform-locale and
 * browser-locale stay aligned.
 *
 * Server callers should pass `locale` explicitly; client callers can omit
 * it and the helper reads the cached locale.
 */

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
