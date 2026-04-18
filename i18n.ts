import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'fr', 'es', 'pt', 'ar', 'zh', 'ja', 'ko', 'tr', 'hi'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  ar: 'العربية',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  tr: 'Türkçe',
  hi: 'हिन्दी',
};

export const rtlLocales: Locale[] = ['ar'];

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  const resolvedLocale = (locales as readonly string[]).includes(locale ?? '')
    ? (locale as Locale)
    : defaultLocale;

  const messages = (await import(`./messages/${resolvedLocale}.json`)).default;
  return { locale: resolvedLocale, messages };
});
