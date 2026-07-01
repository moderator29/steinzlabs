import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const vtxAgentHowItWorks: HowItWorksContent = {
  title: 'VTX Agent',
  tagline: 'A crypto research assistant that pulls live market data, on-chain intelligence, and security checks before it answers.',
  howItWorks: [
    'VTX Agent is a conversational analyst for crypto: ask about a token, a wallet, the broader market, or a specific risk, and it gathers fresh data and reasons over it before replying instead of answering from memory.',
    'Under each answer sits a real data pipeline. Prices, market cap, and Fear and Greed sentiment come from CoinGecko, live pair liquidity and volume from DexScreener, contract safety and honeypot signals from GoPlus, on-chain wallet and balance context from Alchemy and Helius, and Solana token depth from Birdeye, with Jupiter used to quote swap routes.',
    'When a token enters the conversation VTX renders a rich token card showing live price, 24h change, volume, liquidity, market cap, fully diluted value, holder count, and a sparkline chart, so you read the numbers and the recent trend together rather than parsing a wall of text.',
    'If your message is about trading a token, VTX can attach a ready to sign Swap Card that quotes the route and amounts inline; if no wallet is connected it shows a gate prompting you to connect one before the swap can execute.',
    'Each token card carries one tap follow ups for a security scan, a price chart, a swap, or a deeper fundamentals and momentum breakdown, and every reply ends with suggested next questions so research keeps moving.',
    'You can shape how VTX works through settings: personality, analysis depth of Quick, Standard, or Deep, response style of concise or detailed, response language, risk appetite, a default chain across Solana, Ethereum, BSC, Base, and Polygon, plus optional web search, auto charts, and a reply chime.',
    'Conversations are saved to your history both locally and to your account, so you can reopen an earlier thread from the rail or start a clean chat at any time; on the free tier you get a set number of messages per day, while Pro removes the cap.',
  ],
  howToUse: [
    'Type a question into the chat box, such as a token symbol, a wallet or contract address, or a market question, then press send. The quick action chips and the tool grid give you ready made prompts for trending tokens, deep dives, network status, and a full market overview.',
    'Read the reply alongside any token card VTX attaches, using the sparkline and the volume, liquidity, market cap, FDV, and holder figures to judge whether the move has real depth behind it.',
    'Use the card follow up buttons to go further: run a security scan, pull up the price chart, ask for fundamentals and risks, or start a swap, and tap the suggested questions under a reply to keep the thread going.',
    'When you want to trade, open the Swap Card that VTX surfaces, confirm the amounts and route, and connect a wallet if prompted before signing.',
    'Open settings to match the agent to how you trade: choose a personality, set analysis depth to Quick, Standard, or Deep, switch response style, pick your default chain and language, and dial in a risk appetite.',
    'Turn on web search when you need live external context folded into the answer, and enable auto charts or the reply chime if you want those cues.',
    'Use the history rail to reopen a past conversation, or start a new chat to research a fresh idea without the previous context bleeding in.',
  ],
  why: [
    'VTX collapses the usual scramble across price sites, chart tools, contract scanners, and explorers into one chat, so you get live numbers, risk context, and a path to trade without juggling tabs.',
    'Reach for it when you are sizing up an unfamiliar token, screening a contract before you ape in, or want a fast read on the market without leaving the platform, especially when speed and a second opinion matter.',
    'Because token and swap cards turn a plain answer into an action, the gap between an idea and a trade shrinks to a few taps inside the same conversation.',
    'Saved history means your research compounds over time, letting you revisit what you asked, what VTX found, and how a token has moved since.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Token cards now load their chart and market data inline and cache it for the session, so the same token paints instantly instead of showing a loading placeholder.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The chat now fills the screen correctly on mobile, keeping the input box reachable above the keyboard and fixing the half rendered view for long histories.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'VTX can surface a ready to sign Swap Card directly from chat, with a wallet connect gate, so you can trade a token it found without leaving the conversation.',
    },
  ],
};
