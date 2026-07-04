import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const whaleCompareHowItWorks: HowItWorksContent = {
  title: 'Whale Compare',
  tagline: 'Put two to four tracked wallets side by side and see, at a glance, which one is the better trader and what they are all quietly buying.',
  howItWorks: [
    'You choose between two and four wallets, either by pasting their addresses or tapping one of the top tracked whales, and the page pulls each wallet from the curated whale directory along with its recent on-chain activity.',
    'Every wallet is shown as a column with the same set of real metrics: win rate, whale score, thirty-day profit and loss, seven-day volume, portfolio value, trade count, average holding time, and when it was last active, so you are always comparing like for like.',
    'For each metric the strongest wallet in the row is highlighted in gold, so you can read down the columns and immediately see who wins on reputation, who wins on profit, and who trades the most, without doing the math yourself.',
    'Under each wallet the page lists its largest recent buys, and any token that more than one of the compared wallets bought is highlighted, so shared positions jump out.',
    'A dedicated shared-conviction panel then collects every token that at least two of the selected wallets bought in the recent window, ranked by how many of them are in it, which is the clearest signal that these traders agree on something.',
    'Everything shown is real on-chain data from the whale reputation table and the whale-activity pipeline, with honest blanks where a value genuinely is not known rather than a filled-in guess.',
  ],
  howToUse: [
    'Open Whale Compare from the Whale Tracker tab bar.',
    'Add wallets by pasting an address and pressing Add, or tap the quick-add chips for the top tracked whales, up to four at a time.',
    'Press Compare to load the side-by-side view.',
    'Read down each metric row: the gold value is the best wallet for that metric, and negative profit is shown in red.',
    'Scan the shared-conviction panel at the bottom to see the tokens these wallets have in common, then open any wallet or token to dig deeper.',
  ],
  why: [
    'Finding one good wallet is useful, but knowing whether it is actually better than another, and on which dimension, is what turns watching into deciding, and no other platform lets you diff whales head to head like this.',
    'Because every wallet is scored on the same real metrics with the best one highlighted, you can rank candidates for copy-trading or watching in seconds instead of clicking through profiles one at a time.',
    'The shared-conviction panel surfaces the highest-signal outcome of a comparison: when several proven traders independently buy the same token, that agreement is worth far more than any single wallet moving alone.',
    'Reach for it when you are deciding which whale to follow, when you want to confirm a wallet is genuinely elite before copying it, or when you want to see what a group of smart wallets is collectively accumulating.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Whale Compare launched: put two to four tracked wallets side by side with per-metric winners highlighted and a shared-conviction panel showing what they are all buying.',
    },
  ],
};
