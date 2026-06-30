import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const messagesHowItWorks: HowItWorksContent = {
  title: 'Messages',
  tagline: 'A private, real-time inbox for direct conversations with anyone on the platform.',
  howItWorks: [
    'Messages is a direct messaging inbox where you can reach any signed-in member of the platform, with encryption applied per conversation rather than as a blanket promise.',
    'When the person you are messaging has published an encryption key, a fresh conversation key is generated in your browser and sealed separately for each side using libsodium, so the server only ever stores ciphertext and the thread is end-to-end encrypted from the very first message.',
    'When the other person has not published a key, the conversation opens in plaintext so it still works, and each thread header tells you the truth by showing an Encrypted shield or a Not encrypted indicator instead of overstating what is happening to your words.',
    'Your inbox is split into two tabs: Primary holds accepted conversations, while Requests holds opening messages from people who do not follow you back, holding them aside until you accept or decline.',
    'The inbox stays live over a Supabase Realtime connection, so new messages, last-message previews, unread counts, read receipts, and incoming requests update in place without a reload, and a typing indicator appears inside a thread while the other person is composing.',
    'Each inbox row shows the person, the latest preview, the last activity date, and an unread badge, and inside a thread your sent messages show a Read marker once the other side has seen them.',
  ],
  howToUse: [
    'Open Messages from the dashboard to load your inbox, then switch between the Primary and Requests tabs to read accepted threads or review people waiting on your acceptance.',
    'Type a username or display name into the search bar at the top to find anyone on the platform, then tap a result to open or start a conversation with them.',
    'Tap any conversation to open the full thread, read the messages, and use Load older messages at the top to page back through earlier history.',
    'Write in the composer at the bottom and press Enter to send or Shift and Enter to add a new line, and if a send fails your text stays in place with a clear error so nothing silently disappears.',
    'When a thread arrives as a request, use Accept to move it into Primary or Decline to remove it, and note that simply replying also accepts it.',
    'Open the settings menu from the inbox to mark every conversation as read, filter the list to unread only, and toggle notification sound and read receipts to match how you want to be reachable.',
  ],
  why: [
    'Direct messaging keeps your trading and research conversations inside the same place you track wallets and markets, so you can compare a call or share a thread without leaving the platform.',
    'Per-conversation encryption and ciphertext-only storage mean private discussions stay private by design whenever both sides have a key in place, and the header never lets you assume more protection than you actually have.',
    'The Requests tab keeps cold opening messages out of your main inbox, so you stay reachable to the people you want while deciding who else gets through.',
    'Real-time delivery, live unread badges, read receipts, and a typing indicator make fast back-and-forth practical when timing matters, without refreshing to see whether a reply landed.',
  ],
  whatsNew: [
    {
      date: 'June 2026',
      tag: 'FIXED',
      text: 'A network send failure now surfaces an error and keeps your text in place instead of letting the message vanish, and the history of a declined request no longer reappears.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'The real-time connection now reauthorizes on session refresh, so new messages and read receipts arrive live in the inbox and thread rather than only after a reload.',
    },
    {
      date: 'June 2026',
      tag: 'IMPROVED',
      text: 'Encryption is now shown honestly per conversation, with each thread displaying its real Encrypted or Not encrypted state in the header.',
    },
  ],
};
