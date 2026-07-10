import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const giftHowItWorks: HowItWorksContent = {
  title: 'Gifting',
  tagline: 'Send real crypto to another person straight from your wallet, with the platform never holding the funds.',
  howItWorks: [
    'Gifting is a peer-to-peer crypto transfer you can start from a post in the Feed or from someone\'s profile, so you can reward a good call or support a creator without leaving the page.',
    'It is fully non-custodial. Funds move directly from your own connected wallet to the recipient\'s resolved receive address, and the platform never takes custody of the amount at any point.',
    'You can gift across several networks: Ethereum, Base, BNB Chain, Robinhood Chain, each sending native ETH on that network, and Solana sending native SOL.',
    'When you pick a recipient, the app resolves their receive address for the chain you choose, so you send to the correct destination without copying and pasting a wallet address by hand.',
    'You confirm and sign the transfer in your own wallet, and once it is broadcast you can follow it on the network like any other on-chain transaction.',
  ],
  howToUse: [
    'Find the person you want to reward, either on one of their posts in the Feed or on their profile.',
    'Tap Gift to open the gift sheet with that person set as the recipient.',
    'Choose the network you want to send on from Ethereum, Base, BNB Chain, Robinhood Chain, or Solana.',
    'Enter the amount you want to send and review the recipient and the resolved receive address.',
    'Confirm and sign the transfer in your connected wallet.',
    'Watch the confirmation, and share or close the success card once the transfer is on its way.',
  ],
  why: [
    'A like is a nod, but a gift carries real value, so the people making genuinely useful calls can be rewarded directly by the readers who benefited.',
    'Because the transfer is non-custodial and wallet to wallet, you stay in full control of your funds and the platform never sits in the middle holding your money.',
    'Address resolution across five networks means you can send on the chain that suits you without hunting for the right wallet address or worrying about pasting the wrong one.',
    'Reach for it when a post saved you from a bad trade, when a creator\'s work deserves more than a tap, or when you simply want to send someone crypto quickly.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Gifting arrives as a non-custodial peer-to-peer transfer you can send from any post or profile, moving funds straight from your wallet to the recipient.',
    },
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Gifts can be sent on Ethereum, Base, BNB Chain, and Robinhood Chain as native ETH, and on Solana as native SOL, with the recipient address resolved for you.',
    },
  ],
};
