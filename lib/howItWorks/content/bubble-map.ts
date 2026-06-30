import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const bubbleMapHowItWorks: HowItWorksContent = {
  title: 'Bubble Map',
  tagline: 'See exactly who holds a token and how the supply is spread, drawn as a live interactive graph.',
  howItWorks: [
    'Bubble Map pulls a token\'s real holder data from on-chain contract intelligence and draws each holder as a bubble, sized by the share of supply it controls and colored by what it is, such as exchange, whale, contract, DEX, team, or a flagged scammer wallet.',
    'The center bubble is the token itself, and the lines connect related wallets so you can spot concentration and coordination between holders rather than reading a flat list.',
    'A risk read sits above the graph, scoring how concentrated supply is in the top wallets and labeling it low, medium, high, or extreme so you know at a glance how tight the float is.',
    'A built-in agent reads the same holder context you are looking at and answers questions in plain language about top holders, supply concentration, and dev-wallet patterns.',
  ],
  howToUse: [
    'Pick the chain, then paste a token contract address into the search bar and press Analyze.',
    'Switch between Token Holders, Wallet Network, and Cluster View to study distribution from different angles.',
    'Tap any bubble to open its panel with holder type, exact share, wallet address, and a link to the right block explorer for that chain.',
    'Use the Find wallet box to pin a specific address inside a busy graph, and ask the agent questions like who the top holders are or how risky the token looks.',
    'Tap Share to copy a signed link that reopens the same token and view for anyone you send it to.',
  ],
  why: [
    'Supply concentration is one of the clearest early signals of risk, and seeing it as a map makes a top-heavy or coordinated holder base obvious in seconds.',
    'Entity labels and scammer flags turn raw addresses into context, so you can tell an exchange wallet from an insider cluster without leaving the page.',
    'The agent and shareable views let you go from a quick check to a documented call you can pass to others.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Bubble Map visualizes a token\'s holder distribution as an interactive graph with entity labels, a concentration risk read, and a built-in agent for holder questions.',
    },
  ],
};
