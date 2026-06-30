import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const marketMakerHowItWorks: HowItWorksContent = {
  title: 'Market Maker',
  tagline: 'Run automated grid and range strategies that quote both sides of a token, fully non-custodial.',
  howItWorks: [
    'You configure a strategy on a chain and token, and the engine builds a ladder of buy rungs below and sell rungs above a reference price, spaced from your spread out to your band.',
    'The reference price can track the live market mid or stay fixed at a manual value you set, and every order respects your order size, total budget, inventory cap, and maximum slippage.',
    'On supported EVM chains, execution runs through a capped, expiring session key, so the platform can place orders for you while your main wallet keys stay in your browser.',
    'Each strategy reports its status, spend against budget, current inventory, and realized profit and loss, so you always see where it stands.',
  ],
  howToUse: [
    'Open Market Maker and tap New Strategy to start configuring.',
    'Pick the chain and paste the token address, then let the symbol resolve so you know you have the right token.',
    'Choose Grid or Range, set your spread, levels per side, band, order size, budget, and guards, and check the ladder preview.',
    'Create the strategy. It starts paused, so nothing trades until you fund the session key on that chain and activate.',
    'Use Activate, Pause, or Stop on any card to control it instantly, and Refresh to pull the latest numbers.',
  ],
  why: [
    'Automated two-sided quoting lets you provide liquidity and capture spread on a token without watching the order book yourself.',
    'Hard limits on order size, budget, inventory, and slippage, plus an instant pause or stop, keep you in control of risk at all times.',
    'Funds stay non-custodial: a capped, revocable session key does the work, and your main keys never leave your device.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Configure non-custodial grid and range market-making strategies with a live ladder preview and instant pause or stop controls.',
    },
  ],
};
