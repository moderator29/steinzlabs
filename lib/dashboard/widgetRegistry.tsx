import type { ComponentType, ReactNode } from 'react';
import { PortfolioHeroCard } from '@/components/dashboard/PortfolioHeroCard';
import { SinceLastLoginDigest } from '@/components/dashboard/SinceLastLoginDigest';

/**
 * OV3: registry of reorderable dashboard widgets. Each slug maps to a
 * React component the dashboard renders + a friendly label the
 * orderer UI surfaces. Keep slugs stable — they're persisted into
 * user_preferences.dashboard_widgets via /api/dashboard/widgets.
 */

export interface DashboardWidget {
  slug: string;
  label: string;
  description: string;
  Component: ComponentType;
  /** Default visible? Hidden widgets are still re-orderable. */
  defaultVisible: boolean;
}

export const DASHBOARD_WIDGETS: ReadonlyArray<DashboardWidget> = [
  {
    slug: 'hero',
    label: 'Portfolio hero',
    description: 'Total balance + 24h change. Hides automatically for users with no connected wallets.',
    Component: PortfolioHeroCard,
    defaultVisible: true,
  },
  {
    slug: 'digest',
    label: 'Since last login',
    description: 'New alerts + watchlist movers since your previous session.',
    Component: SinceLastLoginDigest,
    defaultVisible: true,
  },
  // NOTE: the 'personalized-home' widget (PersonalizedHome) was removed from
  // the Overview surface. It bundled the "What are you trading today? / Ask VTX
  // anything…" MiniVtxPanel preview AND a SECOND greeting ("Welcome, {name}")
  // that duplicated the OverviewHero greeting at the top of Overview. Both were
  // called out as noise. VTX remains reachable from the bottom-nav "VTX Agent"
  // entry and /dashboard/vtx-ai. The watchlist / smart-money / alerts value it
  // surfaced is now covered by the DailyPulseSummary card on Overview.
];

export const DEFAULT_WIDGET_ORDER: ReadonlyArray<string> = DASHBOARD_WIDGETS.map((w) => w.slug);

export function renderWidget(slug: string): ReactNode {
  const w = DASHBOARD_WIDGETS.find((x) => x.slug === slug);
  if (!w) return null;
  const C = w.Component;
  return <C key={slug} />;
}
