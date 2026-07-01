import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const approvalManagerHowItWorks: HowItWorksContent = {
  title: 'Approval Manager',
  tagline: 'See every contract that can spend your tokens, flag the risky ones, and revoke what you no longer trust.',
  howItWorks: [
    'You enter an EVM wallet address and pick a chain, and the scanner reads that wallet’s real on-chain ERC-20 approval history through Alchemy by replaying every Approval event the address ever emitted, so the list reflects actual permissions rather than guesses.',
    'For each unique token and spender pair it finds, the scanner calls the token’s live allowance function and keeps only the approvals that are still active, dropping anything you have already revoked down to zero.',
    'Every remaining approval is enriched in parallel with Alchemy token metadata, which fills in the token symbol and name, and a GoPlus address security check on the spender, which surfaces whether that contract is reported as malicious or tied to phishing.',
    'Well known routers and protocols such as Uniswap, SushiSwap, 1inch, 0x, ParaSwap, Permit2, and OpenSea Seaport are matched to friendly labels, while anything unrecognized shows a shortened address so an unfamiliar spender stands out at a glance.',
    'Each approval is rated Safe, Unlimited, or Danger: an uncapped spending limit is flagged Unlimited as a precaution, and any spender that GoPlus reports as malicious or phishing is escalated to Danger and sorted to the top of the list.',
    'A summary row across the top counts your total active approvals, how many carry an unlimited cap, and how many are dangerous, and a single verdict of all safe, review needed, or high risk tells you at a glance whether the wallet needs attention.',
    'The results also note how many unique token contracts were scanned and the exact time of the scan, so you always know how fresh the picture is.',
  ],
  howToUse: [
    'Open the Approval Manager from the dashboard.',
    'Choose the chain you want to check using the selector, which covers Ethereum, BSC, Polygon, Base, and Arbitrum.',
    'Paste the wallet address you want to audit into the field and press Scan, then wait while it replays the approval history and runs the security checks.',
    'Read the summary cards first to see your total, unlimited, and dangerous counts, and check the overall verdict badge on the active approvals panel.',
    'Work down the active approvals list from the top, where the riskiest entries are sorted first, and study each spender label, allowance value, and risk badge.',
    'Prioritize anything marked Danger or carrying an unlimited allowance, especially spenders for protocols you no longer use.',
    'Tap Revoke Approvals to open the same wallet and chain on revoke.cash, where you can sign the transactions that remove the permissions you no longer want.',
  ],
  why: [
    'A forgotten unlimited approval lets a contract keep pulling a token long after you stopped using it, so finding and cutting those stale permissions closes a real and common drain path on a wallet.',
    'Reach for it after trading on a new protocol, before moving significant value into a wallet, or as a periodic hygiene check, since approvals quietly accumulate every time you swap or mint.',
    'Bringing labeled spenders, live allowance values, and independent security flags into one view turns a hidden technical risk into a clear decision about what to keep and what to remove.',
    'It pairs naturally with the rest of a research and security workflow: scan a wallet, identify exposure here, then act on revoke.cash to harden the wallet before your next move.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'NEW',
      text: 'Spenders are now scored with a live GoPlus security check, so contracts reported as malicious or phishing are escalated to a Danger rating and pushed to the top of the list.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Known routers and protocols including Uniswap, 1inch, 0x, ParaSwap, Permit2, and OpenSea Seaport now resolve to friendly labels, making unfamiliar spenders easier to spot.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Scan any EVM wallet across Ethereum, BSC, Polygon, Base, and Arbitrum to surface active token approvals, flag unlimited caps, and jump straight to revoking them on revoke.cash.',
    },
  ],
};
