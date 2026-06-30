import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const vtxAgentHowItWorks: HowItWorksContent = {
  title: 'VTX Agent',
  tagline: 'A chat assistant for crypto that checks live data before it answers.',
  howItWorks: [
    'VTX Agent is a chat assistant built for crypto. Ask it about a token, a wallet, or the market, and it pulls live prices, on-chain intelligence, and security checks before it replies.',
    'When a token comes up, VTX renders a rich card with price, liquidity, and market data, and it can surface a ready to sign Swap Card so you can act without leaving the chat.',
    'You can tune how it responds: turn on web search, pick a response style and personality, and set a default chain so answers match the way you trade.',
    'Every conversation is saved to your history, so you can return to a past thread or start a fresh chat whenever you want.',
  ],
  howToUse: [
    'Type a question in the chat, for example a token symbol, a wallet address, or a question about the market.',
    'Read the reply along with any token card VTX attaches, and open the Swap Card when you want to trade the token it found.',
    'Open the settings panel to switch personality, response style, web search, and default chain.',
    'Use chat history to reopen an earlier conversation, or tap new chat to start clean.',
  ],
  why: [
    'VTX does the lookups for you, so you get live data, risk context, and a path to trade in one place instead of juggling tabs.',
    'Token and swap cards turn a plain answer into an action, which shortens the gap between an idea and a trade.',
    'Saved history means your research compounds, because you can revisit what you asked and what VTX found.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Token cards now load chart and market data inline instead of showing a loading placeholder.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The chat fills the screen correctly on mobile, so the input no longer sits under the keyboard.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'VTX can surface a ready to sign Swap Card from chat, so you can trade a token it found without leaving the conversation.',
    },
  ],
};
