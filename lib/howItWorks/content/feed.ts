import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const feedHowItWorks: HowItWorksContent = {
  title: 'The Wire',
  tagline: 'The Wire is your social layer inside Naka Labs: post calls, react on-chain, and reward the people who get it right, all from your own wallet.',
  howItWorks: [
    'A wire is a short post you write in the full-page composer. You can add up to four images, tag it with topics from the Options dropdown, and lean on the AI draft helper to turn rough notes or a ticker into a clean draft that you still review before you send.',
    'Type a cashtag like $SOL or $BTC and it turns into a live price chip. Anyone reading your wire can tap the chip to see the current price, so a call always carries the number behind it.',
    'Any wire can receive on-chain tips and gifts, and the value it has earned shows right on the post. Every gift is non-custodial: the sender signs it from their own wallet, so nothing passes through us.',
    'Each account carries a Signal score from 0 to 100. It is a transparent read on reputation built from real on-chain activity and genuine engagement, not a black box, and it helps rank what rises in the feed.',
    'You can attach an inline prediction to a wire, for example a call that SOL trades below a target within the hour. Readers tap to agree with it, and it ties into Naka Predict, so a hunch becomes something you can track.',
    'Reposts (relay) push a wire to your own followers, and replies open as a thread in a side panel when you tap the comment icon, so a conversation never pulls you away from the feed.',
    'The post menu (the "..." on a wire) lets you Share a wire, Mute a user, or Delete your own wire. Muting hides someone from your feed while their profile keeps working normally.',
    'Every wire has a public share link. You can drop it anywhere off the platform, and people can preview the wire and follow it back into Naka Labs.',
  ],
  howToUse: [
    'Open The Wire and pick a feed: Latest for everything newest first, Signal for wires ranked by real engagement and Signal score, or Pack for only the people you follow.',
    'Tap a topic to filter the stream to that subject. The filter applies on its own, and tapping it again clears it.',
    'Tap the compose button to open the full-page composer. Write your wire, add up to four images, choose topics from the Options dropdown, and use the AI draft helper if you want a cleaner start.',
    'Add a cashtag like $SOL for a live price chip, or attach an inline prediction others can tap to agree with, then post.',
    'On any wire, relay it to your followers, tap the comment icon to reply in the side-panel thread, or send an on-chain tip or gift straight from your wallet.',
    'Open the "..." menu on a wire to Share a public link, Mute a user, or Delete a wire you posted.',
    'Visit a profile to browse a person by Posts, Replies, Media, Reposts and Gifts.',
  ],
  why: [
    'Tips, gifts and the Signal score mean good calls get rewarded and rise on merit, all non-custodially, so appreciation and reputation both carry real weight.',
    'Cashtags and inline predictions keep a call grounded in a real number and a real outcome, so The Wire reads like a trading floor, not just a timeline.',
    'Latest, Signal and Pack let you move between the raw stream, what is genuinely gaining traction, and your own circle, all without leaving the page.',
    'Public share links carry a wire beyond the platform and give newcomers a clean preview and a way in, so a great call can travel.',
    'The Wire works cleanly on mobile, tablet and desktop, so you can read, post and reward from wherever you are.',
  ],
  whatsNew: [
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'The Wire arrives as the SocialFi layer: a full-page composer with up to four images, topics behind Options, and an AI draft helper.',
    },
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'Cashtags like $SOL and $BTC turn into live price chips anyone can tap, and inline predictions let readers tap to agree, tied into Naka Predict.',
    },
    {
      date: 'July 2026',
      tag: 'NEW',
      text: 'On-chain tips and gifts land on any wire with the value shown on the post, and a transparent 0 to 100 Signal score helps rank the feed on real activity.',
    },
    {
      date: 'July 2026',
      tag: 'IMPROVED',
      text: 'Latest, Signal and Pack feeds with auto-applying topic filters, relay reposts, side-panel reply threads, public share links, and Posts, Replies, Media, Reposts and Gifts tabs on every profile.',
    },
  ],
};
