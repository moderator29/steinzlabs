import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const freshMoneyHowItWorks: HowItWorksContent = {
  title: 'Fresh Money Detector',
  tagline: 'See the wallet-age mix behind a token’s buyers, because a token bought mostly by brand-new wallets is usually farmed hype, not real demand.',
  howItWorks: [
    'For each token the detector reads how old its buyers’ wallets are, split into four bands: created in the last seven days, seven to thirty days, thirty to ninety days, and over ninety days old.',
    'Those bands are drawn as a single composition bar coloured from red for the newest wallets to green for the oldest, so you can read a token’s demand quality in one glance.',
    'A plain badge summarizes it: fresh-wallet heavy when the majority of buyers are less than a week old, mixed when the ages are spread, and seasoned money when established wallets dominate.',
    'The idea is that coordinated farms, sybil rings, and manufactured hype spin up fresh wallets in bulk, so a wall of brand-new buyers is a classic warning sign, while old wallets buying signals genuine, considered conviction.',
    'Tokens are shown only when they have a real buyer base rather than a handful of dust trades, symbols are resolved from on-chain activity where whales have touched the token, and everything is real measured data with an honest short-address label when a symbol is unknown.',
  ],
  howToUse: [
    'Open Fresh Money Detector from the sidebar.',
    'Leave it on Most fresh to surface the tokens with the highest share of brand-new-wallet buyers, or switch to Most buyers to rank by crowd size.',
    'Filter by chain to focus on one network.',
    'Read each token’s composition bar (a lot of red means new wallets dominate, more green means seasoned holders) and the badge for the quick verdict.',
  ],
  why: [
    'The most common trap in new tokens is a wall of volume and buyers that turns out to be a wallet farm, and buyer-age composition is one of the cleanest ways to catch that before you enter.',
    'Distinguishing fresh farmed demand from seasoned conviction changes how you should treat a move: the same price action means very different things depending on who is behind it.',
    'Turning wallet age into a coloured bar and a one-word verdict makes a sophisticated sybil check readable in a second, without any manual wallet forensics.',
    'Reach for it before buying a trending token, to sanity-check whether hype is organic, or to actively avoid launches whose demand is manufactured, and pair it with the Wash Trade Radar for a full authenticity read.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Fresh Money Detector launched: the wallet-age composition of every token’s buyers, with a fresh-versus-seasoned verdict that flags farmed and sybil-driven demand.',
    },
  ],
};
