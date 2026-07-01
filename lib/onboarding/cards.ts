/**
 * Onboarding card definitions — 10 cards covering the Steinz Labs
 * platform. Copy lives here so the OnboardingFlow component stays
 * lean and the admin /admin/onboarding-analytics page can reference
 * the same titles for funnel charts.
 *
 * Variants: 'a' (default) and 'b' (alternative copy) for A/B testing.
 * Server-side variant assignment happens in /api/onboarding/variant.
 */

export interface OnboardingCard {
  index: number;
  title: { a: string; b?: string };
  body: { a: string; b?: string };
  illustration: 'logo' | 'dashboard' | 'wallet' | 'vtx' | 'whale' | 'sniper' | 'social' | 'shield' | 'palette' | 'celebrate';
}

export const ONBOARDING_CARDS: OnboardingCard[] = [
  {
    index: 1,
    title: { a: 'Welcome to Naka Labs', b: 'Welcome to Naka Labs' },
    body: {
      a: 'Multi-chain crypto intelligence and trading. Built for serious traders.\nLet\'s walk through what makes us different.',
      b: 'The professional intelligence layer for on-chain markets. Built for traders who measure twice.\nLet\'s tour what makes Naka different.',
    },
    illustration: 'logo',
  },
  {
    index: 2,
    title: { a: 'Your Dashboard' },
    body: {
      a: 'Your command center. Real-time market data, top gainers, trending coins, and personalized insights.\nCustomize it to fit how you trade.',
    },
    illustration: 'dashboard',
  },
  {
    index: 3,
    title: { a: 'The Internal Wallet' },
    body: {
      a: 'Self-custodial. BIP39 seed phrase. AES-256-GCM encrypted. Your keys, your crypto.\nSend, receive, swap across 8 chains.',
    },
    illustration: 'wallet',
  },
  {
    index: 4,
    title: { a: 'VTX Agent' },
    body: {
      a: 'Your AI co-pilot. Real-time on-chain intelligence, instant token analysis, integrated swaps.\nJust ask. VTX has access to whale data, market trends, and your portfolio context.',
    },
    illustration: 'vtx',
  },
  {
    index: 5,
    title: { a: 'Whale Tracker' },
    body: {
      a: 'Follow 15,000+ verified whales across 8 chains. See their moves in real-time.\nCopy their trades with three modes: Alerts, One-Click, or Auto-Copy.',
    },
    illustration: 'whale',
  },
  {
    index: 6,
    title: { a: 'Sniper Bot' },
    body: {
      a: 'Sub-2-second token launches. Anti-MEV protection. Multi-chain support.\nBe first to the move, automatically.',
    },
    illustration: 'sniper',
  },
  {
    index: 7,
    title: { a: 'The Social Layer' },
    body: {
      a: 'Follow top performers. Send encrypted DMs to mutual follows.\nReputation built on real on-chain success, not opinions.',
    },
    illustration: 'social',
  },
  {
    index: 8,
    title: { a: 'Security That Protects You' },
    body: {
      a: 'Built-in security: GoPlus rug detection, Domain Shield, Contract Analyzer, Approval Manager, Risk Scanner.\nTrade with confidence — we screen every move.',
    },
    illustration: 'shield',
  },
  {
    index: 9,
    title: { a: 'Customize Your Experience' },
    body: {
      a: 'Dark or light mode. Personalize notifications. Choose your default chain.\nMake Naka Labs feel like home.',
    },
    illustration: 'palette',
  },
  {
    index: 10,
    title: { a: 'Ready to Begin' },
    body: { a: 'You\'re all set. Real intelligence, real trades, real connections.' },
    illustration: 'celebrate',
  },
];

export const TOTAL_CARDS = ONBOARDING_CARDS.length;
