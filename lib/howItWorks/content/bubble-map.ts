import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const bubbleMapHowItWorks: HowItWorksContent = {
  title: 'Bubble Map',
  tagline: 'See exactly who holds a token and how the supply is spread, drawn as a live interactive graph.',
  howItWorks: [
    'Bubble Map turns a token contract address into a live force-directed graph where every holder is a bubble sized by the share of supply it controls and colored by what it is, including exchange, whale, contract, DEX, team, an unknown wallet, or a wallet flagged as a scammer or rug puller.',
    'The holder set and entity labels come from the platform\'s contract intelligence pipeline, which pulls EVM holders and contract data from Etherscan-family explorers, Solana holders and metadata from Alchemy, broader holder coverage from Birdeye, named-entity labels from Arkham, pair and liquidity data from DexScreener, and a security read from GoPlus, while price, market cap, and the 24 hour change on the center bubble are enriched from CoinGecko.',
    'The center bubble is the token itself and the lines around it connect related wallets, so coordination signals such as same-type holders or wallets holding near-identical amounts surface as visible edges rather than hiding in a flat list.',
    'A risk strip above the graph reads top-wallet concentration and labels it low, medium, high, or extreme, showing how much of the supply the top five wallets hold and a numeric score so you can judge how tight the float is at a glance.',
    'The token header carries live price with its 24 hour move, plus 24 hour volume, market cap, liquidity, and total holder count, giving you the market context alongside the distribution picture.',
    'A built-in Bubble Map Agent reads the same structured context you are viewing, including the symbol, chain, concentration, risk level, and the ranked top holders, then answers in plain language about who the largest holders are, how concentrated supply is, and whether dev-wallet patterns are present.',
    'Holder distribution reflects current on-chain data and the view is marked Live, so the numbers track the chain as it stands rather than a stale snapshot.',
  ],
  howToUse: [
    'Choose the chain from the selector, currently Ethereum, Solana, BNB Chain, Base, Arbitrum, or Polygon, then paste a token contract address into the search bar and press Analyze.',
    'Read the token header and risk strip first to gauge price action, liquidity, holder count, and how concentrated the top wallets are before you study individual bubbles.',
    'Switch between Token Holders, Wallet Network, and Cluster View to look at distribution as a ranked spread, a connected network around the token, or grouped clusters by holder type.',
    'Tap any bubble or any row in the holder list to open its side panel showing holder type, exact share of supply, the full wallet address with a copy button, and a link to the correct block explorer for that chain.',
    'Use the Find wallet box on the graph to pin a specific address, which pulls the matching holder toward the center and outlines it so you can locate it inside a busy map.',
    'Ask the Bubble Map Agent questions in the chat, or tap a suggested prompt such as who the top holders are, whether the token is risky, or whether dev-wallet patterns exist, then edit and send.',
    'Tap Share to copy a signed link that reopens the same token, chain, and view for anyone you send it to, and use the fullscreen toggle when you want the graph to fill the screen.',
  ],
  why: [
    'Supply concentration is one of the clearest early signals of risk, and seeing it as a map makes a top-heavy float or a coordinated holder base obvious in seconds instead of buried in a holder table.',
    'Entity labels and scammer flags turn raw addresses into context, letting you separate an exchange or known market maker from an insider cluster without leaving the page.',
    'It fits naturally between a first look at a token and a sizing decision, pairing the distribution read with live price, liquidity, and a concentration risk score so a quick check and a deeper investigation use the same surface.',
    'The agent and the signed share link let you move from a private read to a documented call you can hand to a teammate or revisit later.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'The view is now marked Live with current on-chain holder data, block-explorer links route to the correct explorer for each chain, and the share button mints a signed link that reopens the same token and view.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Added a dedicated Bubble Map Agent with suggested questions and structured holder context, plus a Find wallet box that pins and highlights a specific address inside the graph.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Bubble Map launched, visualizing a token\'s holder distribution as an interactive force graph with entity labels, Token Holders, Wallet Network, and Cluster View modes, and a top-wallet concentration risk read.',
    },
  ],
};
