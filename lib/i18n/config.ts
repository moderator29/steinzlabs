/**
 * i18n configuration — Naka Labs SEO locale foundation.
 *
 * Branch G ships the foundation only: locale list, default,
 * next-intl request config, and a baseline message bundle. The full
 * app/* → app/[locale]/* file-move is a mechanical codemod step
 * documented in docs/seo-locale-migration.md; doing it here without
 * the ability to browser-verify every route would risk silently
 * breaking 70+ pages.
 *
 * To wire a route into i18n once moved:
 *   1. Move `app/<path>/page.tsx` → `app/[locale]/<path>/page.tsx`.
 *   2. In server components, useTranslations('<namespace>').
 *   3. In client components, import via NextIntlClientProvider in
 *      the new app/[locale]/layout.tsx.
 *   4. Update internal hrefs to use next-intl's Link wrapper.
 */

export const SUPPORTED_LOCALES = ['en', 'es', 'pt', 'fr', 'de', 'ja', 'zh', 'tr', 'ru', 'ko'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Static localized labels for the locale picker. Native names so users
 * find their own language without translating it first.
 */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  zh: '中文',
  tr: 'Türkçe',
  ru: 'Русский',
  ko: '한국어',
};
