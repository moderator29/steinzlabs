import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const washRadarHowItWorks: HowItWorksContent = {
  title: 'Wash Trade Radar',
  tagline: 'See where smart money is flowing and, for each of those tokens, whether the volume is real or wash-traded: the two signals no retail platform shows together.',
  howItWorks: [
    'The radar starts from an independent smart-money cohort and their net dollar flow into every token over the last twenty-four hours, so you are looking at where proven wallets are actually putting money.',
    'For each of those tokens it then pulls a wash-trade authenticity score derived from on-chain trading-pair analysis, where a high score means the volume looks organic and a low score means a large share of the activity is wash-traded, self-dealing volume designed to fake demand.',
    'Every token is graded into a plain badge (real volume, some wash, or wash risk) so you do not need to interpret a raw number to know whether the flow you are seeing is trustworthy.',
    'Token symbols are resolved from the on-chain activity pipeline, stablecoins and majors are demoted by default because their flow is housekeeping rather than a signal, and you can sort either by the biggest smart-money inflow or by the worst wash risk.',
    'Everything shown is real data joined from two independent on-chain sources (the smart-money flow surface and the wash-trade score surface) with an honest unrated badge wherever a token has no authenticity score yet.',
  ],
  howToUse: [
    'Open Wash Trade Radar from the sidebar.',
    'Leave it on Top inflow to see where smart money is buying most, or switch to Wash risk to surface the most heavily wash-traded tokens first.',
    'Filter by chain to focus on one network.',
    'Read each row: the dollar figure on the right is the smart-money net flow, and the colored badge tells you whether that volume is real, partly washed, or a wash risk.',
    'Toggle Show stables/majors when you want cash and blue-chips included.',
  ],
  why: [
    'A token can look like it has huge volume and smart-money interest and still be mostly fake, and the single most expensive mistake in trading low-caps is trusting wash-traded volume: this radar catches exactly that.',
    'Fusing where smart money flows with whether the volume is authentic turns two separate checks into one glance: you see the opportunity and the trap in the same row.',
    'Grading each token into a plain badge means you get an instant, honest read on authenticity without having to understand wash-trade mechanics.',
    'Reach for it before entering any token with surprising volume, to sanity-check a smart-money signal you saw elsewhere, or to actively hunt for and avoid the tokens whose volume is manufactured.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Wash Trade Radar launched: independent smart-money token flow fused with a wash-trade authenticity grade, so you can tell real volume from faked volume at a glance.',
    },
  ],
};
