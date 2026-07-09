import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const newsHowItWorks: HowItWorksContent = {
  title: 'News',
  tagline: 'Crypto headlines tagged for sentiment, topped with a live market mood read and an optional twice-daily digest.',
  howItWorks: [
    'The News tab gathers current crypto headlines and reads each one for sentiment, tagging it bullish or bearish so you can see at a glance which way a story leans before you open it.',
    'A market-mood banner sits above the headlines and shows the current Fear and Greed reading, giving you the overall temperature of the market alongside the individual stories.',
    'A bell shaped Alerts toggle lets you opt into a crypto news digest that is delivered twice a day, so the news comes to you rather than you checking the tab all day.',
    'The digest is sent to the channels you have enabled, which can be Telegram, email, or both, so it lands where you already pay attention.',
    'Email delivery requires the email channel to be enabled on your account, so if you want the digest in your inbox make sure email is switched on in your notification settings.',
  ],
  howToUse: [
    'Open the dashboard and select the News tab.',
    'Read the market-mood banner at the top for the current Fear and Greed reading.',
    'Scan the headlines and use the bullish and bearish sentiment tags to judge the tone of each story before opening it.',
    'Tap the bell Alerts toggle to opt into the twice-daily news digest.',
    'Make sure the channels you want are enabled, Telegram for chat delivery and email for inbox delivery, so the digest reaches you.',
    'Adjust or turn the digest off at any time from the same Alerts toggle.',
  ],
  why: [
    'Sentiment tags turn a wall of headlines into a quick read, so you can tell whether the day is leaning bullish or bearish without reading every story end to end.',
    'The Fear and Greed banner puts each headline in context, which helps you separate a genuine shift from ordinary market noise.',
    'A twice-daily digest keeps you current without living in the News tab, and because it arrives on your own channels it fits the way you already follow the market.',
    'Reach for it at the start and end of your day to stay on top of what is moving before you trade, or to catch up on anything you missed while you were away.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'News headlines now carry bullish and bearish sentiment tags and a market-mood banner showing the live Fear and Greed reading.',
    },
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'A bell Alerts toggle opts you into a twice-daily crypto news digest delivered to your enabled channels, with email available once the email channel is on.',
    },
  ],
};
