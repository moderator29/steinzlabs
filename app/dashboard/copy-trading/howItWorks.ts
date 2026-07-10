import type { HowItWorksContent } from "@/lib/howItWorks/types";

/**
 * In-feature help copy for Copy Trading. Grounded strictly in how the feature
 * actually works: three modes, non-custodial execution through the same signer
 * the rest of the platform uses, real fills only. No invented numbers or dates.
 */
export const copyTradingHowItWorks: HowItWorksContent = {
  title: "Copy Trading",
  tagline: "Mirror a whale's on-chain moves on your own terms, non-custodially.",
  howItWorks: [
    "You create a rule that follows a specific whale address on a chain. The monitor watches that whale's real on-chain activity and matches each new trade against your active rules.",
    "Every match runs your caps and filters first (per-trade cap, daily cap, direction, min trade size, token allow and block lists), then a GoPlus security check, before anything touches the relayer.",
    "Sizing is either a fixed USD amount or a percent of the whale's trade, always clamped to your per-trade cap and remaining daily cap.",
    "The platform never holds your keys. One-Click and Auto-Copy execute through the same non-custodial signer used across the app; you fund and control everything.",
  ],
  howToUse: [
    "Open a whale from the Whale Tracker and tap Copy, or add a rule here by pasting an address and picking a chain.",
    "Pick a mode: Alerts to just get notified, One-Click to confirm a pre-filled swap, or Auto-Copy to mirror hands-free within signed caps.",
    "Set your sizing and caps, then optionally open Filters to limit direction, ignore small whale trades, or restrict to specific tokens.",
    "For Auto-Copy, enable a 24/7 session key and fund it with only the USDC budget you want automated. Pause, edit, or delete any rule anytime.",
  ],
  why: [
    "Whales move fast. Rules let you follow the ones you trust without watching a screen, while your caps keep every copy inside limits you set.",
    "The security gate and honest PnL mean you see only real, confirmed fills, never estimated or fabricated numbers.",
    "Non-custodial by design: a scoped session key executes auto-copies and can never exceed what you fund or the caps you signed.",
  ],
  whatsNew: [
    { date: "July 2026", tag: "NEW", text: "Rule filters for direction, minimum whale trade size, and token allow or block lists." },
    { date: "July 2026", tag: "NEW", text: "Positions view rolls up confirmed fills with realized PnL, plus per-rule copied count and PnL." },
    { date: "July 2026", tag: "IMPROVED", text: "Rules are now editable in place, and whale deep-links pre-fill the chain and label." },
  ],
};
