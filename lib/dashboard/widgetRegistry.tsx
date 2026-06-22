import type { ComponentType, ReactNode } from 'react';
import { PortfolioHeroCard } from '@/components/dashboard/PortfolioHeroCard';
import { SinceLastLoginDigest } from '@/components/dashboard/SinceLastLoginDigest';
import { PersonalizedHome } from '@/components/dashboard/PersonalizedHome';

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
  {
    slug: 'personalized-home',
    label: 'Personalised home',
    description: 'Watchlist movers, hot tokens, smart-money flow, and your active alerts.',
    Component: PersonalizedHome,
    defaultVisible: true,
  },
];

export const DEFAULT_WIDGET_ORDER: ReadonlyArray<string> = DASHBOARD_WIDGETS.map((w) => w.slug);

export function renderWidget(slug: string): ReactNode {
  const w = DASHBOARD_WIDGETS.find((x) => x.slug === slug);
  if (!w) return null;
  const C = w.Component;
  return <C key={slug} />;
}
