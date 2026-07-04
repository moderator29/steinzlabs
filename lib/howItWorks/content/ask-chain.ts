import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const askChainHowItWorks: HowItWorksContent = {
  title: 'Ask the Chain',
  tagline: 'Ask any question about on-chain activity in plain English and get a real answer drawn from live Naka data, with no filters or query language to learn.',
  howItWorks: [
    'You type a question the way you would say it out loud, such as which tokens smart money is buying together, who the top whales are by win rate, or the biggest whale buys in the last day.',
    'The platform uses Claude to translate your question into one safe, structured query chosen from a fixed set of on-chain questions it knows how to answer, so the model never writes raw database code and can only ask the questions the system has vetted.',
    'The server runs that query against live tables of tracked whales, their trades, smart-money convergence, and token security scores, capped to a small result set, and it can only ever read public on-chain intelligence, never any account, wallet, or personal data.',
    'Claude then reads the actual rows that came back and writes a short, specific answer that references the real numbers, followed by a table of the underlying data so you can see exactly where the answer came from.',
    'Every figure is grounded in data the platform already indexes, so there are no invented tokens, wallets, or statistics in the response.',
  ],
  howToUse: [
    'Open Ask the Chain and type your question, or tap one of the suggested prompts to see it in action.',
    'Read the answer at the top, written in plain language and tied to the live data.',
    'Scan the table below the answer for the full result set, then click through to a token or whale to go deeper.',
    'Refine by asking a follow-up, such as narrowing to a chain, a whale style, or a larger trade size.',
  ],
  why: [
    'It turns the entire on-chain dataset into a conversation, so you can get to an answer in seconds without knowing which page, filter, or metric to use.',
    'Because the answer always comes with the real rows behind it, you can trust what you read and verify it yourself, which is the opposite of a chatbot guessing from memory.',
    'The safe, structured design means it stays fast and accurate and can only surface public intelligence, so you get the magic of natural-language querying without any risk to your data.',
    'Reach for it when you have a question but not the patience to build a query by hand, and use it as the fastest front door to everything else the platform tracks.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Ask the Chain launched, letting you query live whale, convergence, and token-safety data in plain English with a cited answer and the underlying table.',
    },
  ],
};
