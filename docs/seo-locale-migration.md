# SEO Locale Migration — playbook

Status: foundation shipped on `chore/seo-locale-foundation`. Per-route
file moves are mechanical and follow the steps below. The migration
is split into a foundation branch (this one) + N consumer-site
branches (one per dashboard surface) so each surface can be
browser-verified before the next moves.

## What's already done (foundation)

- `next-intl@^4.11.0` already in dependencies.
- `lib/i18n/config.ts` — `SUPPORTED_LOCALES` (en/es/pt/fr/de/ja/zh/tr/ru/ko), `DEFAULT_LOCALE`, `isSupportedLocale`, `LOCALE_LABELS`.
- `lib/i18n/request.ts` — `getRequestConfig` reading the route locale + loading the matching message bundle.
- `lib/i18n/messages/en.json` + `lib/i18n/messages/es.json` — baseline `common.*` / `social.*` / `onboarding.*` / `leaderboard.*` namespaces. Other locales fall back to English until their bundle lands.
- `lib/i18n/messages/en.json` now also covers `landing.nav.*` / `landing.hero.*` / `landing.security.*` / `landing.faq.*` / `landing.cards.*` — extracted from `LandingNav.tsx`, `SecurityShowcase.tsx`, `FAQData.ts`, and `cards-data.ts` per Agent-14 audit finding "top-20 hardcoded strings".
- `lib/i18n/formatters.ts` — canonical locale-aware number/currency/percent formatters. Reads the user locale via a singleton populated by `lib/i18n/useTranslate.setCurrentLang`. Use this for all new formatting; the audit's 121-call `.toLocaleString()` sweep is partially addressed by (a) replacing hardcoded `'en-US'` with `undefined` (browser-locale) across the codebase and (b) the new helper for new code. Component-by-component `useLocale()` migration follows naturally as surfaces move under `app/[locale]/`.
- RTL Tailwind logical-property sweep complete: `text-left`/`text-right`, `ml-N`/`mr-N`, `pl-N`/`pr-N` (plus `sm:`/`md:`/`lg:`/`xl:` breakpoints) flipped to `text-start`/`text-end`, `ms-N`/`me-N`, `ps-N`/`pe-N` across every `app/**/*.tsx` and `components/**/*.tsx`. Tailwind 3.4 handles direction natively under `dir="rtl"`. Absolute-position `left-*`/`right-*` left intact — those are intentional pinning.
- Hex token sweep on the 5 highest-density files (wallet-intelligence, ProfileTab, admin, wallet-page, dna-analyzer) for quoted-string-literal hex usages (e.g. `style={{ color: '#0A1EFF' }}`) → CSS variable equivalents. Tailwind-bracketed class-name hex (`text-[#0A1EFF]`) intentionally left for a follow-up because of opacity-modifier composition risk; the inline-style + JS-string usages are the higher-leverage migrations.

## Why per-route moves were NOT batched into this branch

Moving 70+ route files in one PR without browser verification would silently break:
- Internal `<Link href="...">` and `router.push(...)` calls — every absolute path needs `useRouter` from next-intl or to include the locale segment.
- Any server component that reads `params` — the new locale param appears first and shifts every existing param's position.
- `redirect()` / `revalidatePath()` calls that hardcode paths.

The atomic-flip rule (CLAUDE.md, §branch consolidation memory) says all consumers of a primitive flip in ONE branch. For 70+ routes, that branch can't be browser-verified end-to-end in a single session. The right move is the foundation + a documented codemod the owner runs incrementally, surface by surface, with verification at each step.

## Per-route migration steps

For each top-level surface group (e.g. `app/dashboard/security/`, `app/dashboard/portfolio/`):

1. **Move files**:
   ```bash
   git mv app/dashboard/<surface> app/[locale]/dashboard/<surface>
   ```
   Or for the dashboard root, move the whole `app/dashboard/` tree once.

2. **Create / update the locale layout** at `app/[locale]/layout.tsx`:
   ```tsx
   import { NextIntlClientProvider } from 'next-intl';
   import { getMessages } from 'next-intl/server';

   export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
     const { locale } = await params;
     const messages = await getMessages();
     return (
       <NextIntlClientProvider locale={locale} messages={messages}>
         {children}
       </NextIntlClientProvider>
     );
   }
   ```

3. **Add the next-intl plugin** to `next.config.js`:
   ```js
   const withNextIntl = require('next-intl/plugin')('./lib/i18n/request.ts');
   module.exports = withNextIntl(nextConfig);
   ```

4. **Extend `middleware.ts`** with the locale detector (chained with the existing Supabase cookie sweep):
   ```ts
   import createMiddleware from 'next-intl/middleware';
   import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/config';

   const intl = createMiddleware({
     locales: SUPPORTED_LOCALES,
     defaultLocale: DEFAULT_LOCALE,
     localePrefix: 'as-needed',
   });

   export async function middleware(request: NextRequest) {
     // existing Supabase/cookie logic …
     const intlResponse = intl(request);
     if (intlResponse) return intlResponse;
     // continue with existing flow …
   }
   ```

5. **Update internal hrefs** in moved pages from raw strings to next-intl's Link:
   ```tsx
   // before
   import Link from 'next/link';
   // after
   import { Link } from '@/lib/i18n/navigation';
   ```
   (Add `lib/i18n/navigation.ts` exporting `createNavigation` results when the first surface migrates.)

6. **Strings via `useTranslations`**:
   ```tsx
   import { useTranslations } from 'next-intl';
   const t = useTranslations('social');
   // …
   <button>{t('follow')}</button>
   ```

7. **Browser-verify the moved surface** at all three breakpoints (375 / 1024 / 1440) + with the locale switcher applied.

8. **Commit + open one PR per surface group.**

## Surface migration order (recommended)

Smallest-blast-radius first:
1. `app/discover/` + `app/leaderboard/[kind]/` + `app/u/[username]/` — new social surfaces; clean migration target.
2. `app/dashboard/portfolio/`
3. `app/dashboard/whale-tracker/`
4. `app/dashboard/vtx-ai/` + `components/VtxAiTab.tsx`
5. `app/dashboard/wallet-page/`
6. Marketing surfaces (`app/page.tsx`, `app/whitepaper/`, …)
7. Remaining dashboard surfaces in alpha order.

## Translation backfill

After foundation lands, ship machine translations for pt/fr/de/ja/zh/tr/ru/ko via a script (DeepL / Google Translate API) seeded from `en.json` + commit as `messages/<locale>.json`. Native review of high-impact namespaces (onboarding, social) before any locale is announced as "supported."

## Acceptance criteria (per consumer branch)

- All hrefs resolve under the active locale.
- `useTranslations` calls type-check against the bundle.
- Browser-verified at 375 / 1024 / 1440.
- Lighthouse SEO score ≥ 95 on the moved page.
- `hreflang` link tags present in HTML head for every supported locale.

## Owner action

Foundation merges → run codemod for surface group 1 → ship → verify
→ repeat. Estimated 30 min per surface group for the typical
~5-file dashboard surface; longer for the marketing site +
component-heavy surfaces (wallet, swap).
