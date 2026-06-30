import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const signatureInsightHowItWorks: HowItWorksContent = {
  title: 'Signature Insight',
  tagline: 'See exactly what a transaction will do before you approve or sign it.',
  howItWorks: [
    'Signature Insight takes raw transaction calldata or a function signature and decodes the opaque hex blob into a plain English explanation of what the call actually does in your wallet.',
    'Decoding is powered by the GoPlus ABI decoder, which matches the four byte function selector and unpacks the encoded arguments; if that lookup is unavailable, a built-in selector decoder still resolves common calls such as approve, transfer, transferFrom, setApprovalForAll, mint, burn, deposit, withdraw, and ownership changes so you are never left blind.',
    'The result identifies the function name, rebuilds the full human readable signature, and lists every parameter with its name, Solidity type, and decoded value so you can confirm exactly which address or amount the transaction touches.',
    'A risk verdict of Safe, Warning, or Dangerous sits at the top, derived from the specific patterns the decoder finds, including token approvals, transfers on your behalf, delegate calls that run arbitrary code, contract self destruct, and ownership transfers.',
    'The most serious flag is an unlimited token approval, detected when an amount or value field equals the maximum uint256, which is escalated to Dangerous because it grants a contract permission to move that token indefinitely.',
    'The Parameters panel expands to show the raw decoded arguments, and a Before Signing checklist reminds you to verify the target contract, avoid blanket approvals, and revoke permissions you no longer use.',
    'Calldata is decoded against the chain you select across Ethereum, BSC, Polygon, Base, Arbitrum, and Avalanche, and identical inputs return instantly because decoded signatures are cached.',
  ],
  howToUse: [
    'Open Signature Insight from the dashboard.',
    'Select the chain the transaction belongs to from the row of chain buttons, since the same calldata can resolve differently per network.',
    'Paste the transaction calldata into the input box, or tap one of the built in example signatures such as ERC-20 Approve or ERC-20 Transfer to see how decoding works.',
    'Tap Decode Signature and read the verdict banner first, which tells you at a glance whether the call is Safe, a Warning, or Dangerous.',
    'Read the What this transaction does summary and scan the Risk Flags list to understand each concern the decoder raised.',
    'Expand the Parameters panel to confirm the exact recipient address, spender, or token amount, and watch for any value flagged as an unlimited approval.',
    'Work through the Before Signing checklist, then approve or reject the transaction in your wallet, or tap Decode another signature to inspect the next one.',
  ],
  why: [
    'Wallet confirmation prompts rarely show what a transaction truly does, and that blind spot is exactly where drained approvals and abused permissions begin.',
    'Decoding the calldata first turns an unreadable hex string into a clear picture of the function, its parameters, and its risk, so you can catch a dangerous signature before it ever reaches your wallet.',
    'Reach for it whenever a dApp, airdrop, or unfamiliar contract asks you to sign something you do not fully recognize, especially when an approval or transfer permission is involved.',
    'It fits naturally alongside the other Security Center tools, giving you a fast pre signing check that pairs well with reviewing a contract and managing your existing approvals.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Decoded results now surface targeted risk flags for delegate calls, self destruct, ownership transfers, and max uint256 unlimited approvals, with the most severe patterns escalated to a Dangerous verdict.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Decode any transaction calldata into plain English with a risk verdict, a full parameter breakdown, and a before signing checklist across Ethereum, BSC, Polygon, Base, Arbitrum, and Avalanche.',
    },
  ],
};
