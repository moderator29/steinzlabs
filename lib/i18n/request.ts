import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isSupportedLocale } from './config';

/**
 * next-intl request config — resolves the active locale per request
 * and loads the matching message bundle. Wired in next.config.js via:
 *
 *   const withNextIntl = require('next-intl/plugin')('./lib/i18n/request.ts');
 *   module.exports = withNextIntl(nextConfig);
 *
 * Once routes move under app/[locale]/, the locale param falls
 * through from the URL into this function. For now (foundation
 * branch), if no locale param is present we serve the default.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
