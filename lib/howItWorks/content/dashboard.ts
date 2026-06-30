import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const dashboardHowItWorks: HowItWorksContent = {
  title: 'Dashboard',
  tagline: 'Your live home base for the market and your activity.',
  howItWorks: [
    'The Dashboard is your home base. The top row shows live market stats like total market cap, 24h volume, and BTC dominance, followed by a Top Gainers panel and a Heating Up panel drawn from real market data.',
    'Below the market panels, a toggle lets you switch between an Overview of your activity, the Context Feed of on-chain signals, and a Market view.',
    'Everything is sourced from live data, so the numbers reflect the current market rather than a stored snapshot.',
  ],
  howToUse: [
    'Scan the stat cards and market panels at the top for a quick read on where the market is.',
    'Switch between Overview, Context Feed, and Market with the toggle to change what the home area shows.',
    'Use the bottom menu to jump to Find, VTX Agent, Wallet, and Profile, and open the side menu for every other feature.',
  ],
  why: [
    'One screen gives you both the market pulse and your own activity, so you start each session with context.',
    'The Context Feed surfaces signals as they happen, which helps you spot moves early.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The Overview now follows your saved widget order, so the home screen leads with the cards you care about most.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Top Gainers and Heating Up panels bring a live market overview to the home screen.',
    },
  ],
};
