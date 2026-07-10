import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const robinhoodHowItWorks: HowItWorksContent = {
  title: 'Robinhood Chain',
  tagline: 'A supported EVM network where you can hold, send, and gift native ETH today, all non-custodially.',
  howItWorks: [
    'Robinhood Chain is a supported EVM network on the platform, carrying chain id 4663, so it works alongside the other chains you already use.',
    'Its native asset is ETH, and you can hold that ETH in your own wallet on the chain just as you would on any other supported network.',
    'You can send and gift native ETH on Robinhood Chain right now, and every transfer is non-custodial, moving straight from your wallet without the platform holding your funds.',
    'DEX swap routing on Robinhood Chain is coming and will switch on as aggregators list the network, so for now the chain supports holding, sending, and gifting rather than in-app swaps.',
  ],
  howToUse: [
    'Select Robinhood Chain wherever you choose a network, such as your wallet or the gift sheet.',
    'Hold native ETH on the chain in your own non-custodial wallet.',
    'Send ETH to another address, or use Gift to send it to someone from a post or profile, and confirm the transfer in your wallet.',
    'Check back for in-app swap routing on the chain, which will appear once aggregators list Robinhood Chain.',
  ],
  why: [
    'Adding Robinhood Chain as a first-class EVM network means you can hold and move its native ETH inside the same wallet and flows you already know.',
    'Because sending and gifting are non-custodial from day one, you keep full control of your funds on the chain from the start.',
    'Being clear that swap routing is still coming keeps expectations honest, so you know exactly what works today and what is on the way.',
    'Reach for it when you want to hold or move ETH on Robinhood Chain, or to gift someone on the network directly from their post or profile.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Robinhood Chain is now a supported EVM network, so you can hold, send, and gift native ETH on it non-custodially.',
    },
    {
      date: 'July 2026',
      tag: 'IMPROVED',
      text: 'DEX swap routing for Robinhood Chain is on the way and will switch on as aggregators list the network.',
    },
  ],
};
