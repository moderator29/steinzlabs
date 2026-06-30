import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const transactionsHowItWorks: HowItWorksContent = {
  title: 'Transactions',
  tagline: 'Your unified swap and snipe history across every supported chain, in one place.',
  howItWorks: [
    'Transactions reads your real on-chain activity from two separate ledgers tied to your signed-in account: the manual swaps you have executed and the buys the sniper has filled on your behalf.',
    'Both ledgers are pulled at the same time, capped at the most recent fifty entries each, then merged into a single timeline that is sorted newest first so your latest activity always sits at the top.',
    'A swap row shows the token pair that moved, reading as the token you sold into the token you bought, while a snipe row names the token the bot acquired for you and the dollar size of that buy when it is recorded.',
    'Every row also carries the chain it ran on, a status pill, and a relative timestamp, so you can scan what happened, where, and how recently without opening anything.',
    'Status reflects the real outcome on chain and falls into confirmed, pending, or failed, with the underlying ledger vocabularies mapped onto those three buckets and any unknown or missing state shown as pending rather than assumed successful.',
    'When an entry has a real transaction hash, it links straight to the matching block explorer for that chain, covering Ethereum on Etherscan, Base on Basescan, Arbitrum on Arbiscan, Polygon on Polygonscan, BSC on Bscscan, and Solana on Solscan.',
    'Swap rows display the in and out amounts when no dollar value is stored, while snipe rows show a formatted USD figure when the buy size was captured, so the value column always reflects what the source ledger actually recorded.',
  ],
  howToUse: [
    'Open Transactions from the dashboard to load your most recent swaps and snipes into one merged timeline.',
    'Use the All, Swaps, or Snipes toggle at the top to focus the list on just one kind of activity, and note that your choice is preserved if you navigate away and come back.',
    'Read each row left to right for the token movement or sniped token, the status pill, the chain tag, the value or amounts, and the time since it happened.',
    'Watch the status pill to tell confirmed activity from anything still pending or marked failed before you act on a position.',
    'Click the external link icon on any row that carries an on-chain hash to open that exact transaction on its block explorer for full receipt-level detail.',
    'Press Refresh after a new trade settles to pull the latest activity, and watch the icon spin while the two ledgers reload.',
    'If the list is empty, complete a swap or let the sniper fill a buy, and the new entry will appear here on your next load or refresh.',
  ],
  why: [
    'It gives you one honest record of everything you have traded and sniped, so you stop jumping between wallets and a handful of explorer tabs to reconstruct your own history.',
    'Clear status pills and direct explorer links let you confirm exactly what settled on chain and what is still pending, which matters most right after a volatile entry or a fast snipe.',
    'Reach for it when you want to reconcile a position, double check a fill, or review your recent activity before sizing your next move.',
    'Multi-chain coverage keeps your full trading footprint visible from a single view, which fits naturally between executing a trade on Swap or the sniper and reviewing the outcome in your research workflow.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The All, Swaps, and Snipes filter now persists when you open a transaction and return, so your view stays where you left it.',
    },
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'Snipes now order by their real execution timestamp, which stops a sorting error that previously dropped every snipe from the timeline.',
    },
    {
      date: 'June 2026',
      tag: 'NEW',
      text: 'Transactions brings your swap and snipe history together with live status pills and direct block explorer links across all six supported chains.',
    },
  ],
};
