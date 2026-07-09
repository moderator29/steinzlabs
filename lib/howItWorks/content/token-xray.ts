import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const tokenXrayHowItWorks: HowItWorksContent = {
  title: 'Token X-Ray',
  tagline: 'One screen that fuses every smart-money signal for a token (convergence, whales, flow, wash-trading, and buyer age) into a single plain verdict.',
  howItWorks: [
    'You enter a token by symbol or contract address, and the X-Ray gathers five independent real signals for it at once instead of making you visit five different tools.',
    'It checks whether tracked smart-money wallets are converging on the token, which tracked whales are actually holding it and whether they are net buying or selling over thirty days, how the independent Dune smart-money cohort is flowing in or out over the last day, how authentic the token’s volume is on the wash-trade score, and how old the wallets buying it are.',
    'Each signal is shown in its own panel with the real number behind it, and several panels link straight through to the dedicated tool if you want to go deeper.',
    'It then rolls the signals into a plain verdict (strong, mixed, caution, or thin coverage) by listing the concrete positives, such as whales accumulating or authentic volume, against the concrete red flags, such as wash-trade risk or a wall of brand-new-wallet buyers.',
    'The verdict is fully transparent: it is just a readout of the underlying signals, never a black-box score, and every input is real on-chain or Dune data with honest empty states where a signal has no coverage.',
  ],
  howToUse: [
    'Open Token X-Ray from the sidebar, or arrive here from another token surface.',
    'Type a token symbol such as AAVE, or paste a contract address for an exact match.',
    'Read the verdict card first: the green list is what is working for the token, the red list is what to worry about.',
    'Scan the five signal panels for the detail behind the verdict, and tap through to the whale lens, wash radar, or fresh-money detector to dig deeper.',
  ],
  why: [
    'Real token diligence means checking several independent things at once, and doing that by hand across separate tools is slow enough that most people skip it: the X-Ray makes the full check a single search.',
    'Fusing convergence, whale positioning, independent flow, volume authenticity, and buyer age catches setups that any single signal would miss, and just as importantly catches traps that look good on one metric but fail on another.',
    'Because the verdict is a transparent list of real positives and negatives rather than a mystery number, you can trust it and act on it, seeing exactly why a token reads as strong or risky.',
    'Reach for it as the first thing you do on any token you are considering: it is the fastest way to know whether smart money is genuinely behind it and whether the demand is real.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Token X-Ray launched: a single screen fusing convergence, whale positioning, Dune smart-money flow, wash-trade authenticity, and buyer wallet-age into one transparent verdict.',
    },
  ],
};
