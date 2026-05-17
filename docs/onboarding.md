# Onboarding — User Guide

The first time you sign in to Naka Labs you'll see a 10-card tour of the platform.

## The 10 cards

1. **Welcome to Steinz Labs** — overview.
2. **Your Dashboard** — the command center.
3. **The Internal Wallet** — self-custodial, BIP39, AES-256-GCM, 8 chains.
4. **VTX Agent** — your AI co-pilot.
5. **Whale Tracker** — 15,000+ verified whales, three copy modes.
6. **Sniper Bot** — sub-2-second launches, anti-MEV.
7. **The Social Layer** — performance-based reputation, encrypted DMs.
8. **Security That Protects You** — GoPlus, Domain Shield, Contract Analyzer.
9. **Customize Your Experience** — dark/light, notifications, default chain.
10. **Ready to Begin** — get started.

## Controls

- **Next** advances; **Back** returns. On the last card, Next becomes **Get Started**.
- **Skip tour** (bottom-left) opens a confirmation modal; you can replay the tour later from Settings.
- **Arrow keys** on desktop also navigate; **swipe left/right** on mobile.
- **Tap a progress dot** at the top to jump directly to that card.
- The flow respects `prefers-reduced-motion` — animations are disabled if your OS asks for that.

## Replay

Settings → **Replay onboarding** — sets `onboarding_completed_at` back to null so the gate re-mounts the flow on next dashboard load.

## What happens behind the scenes

Each card view / Next click / Skip click / Skip confirm / Completion fires an event to `/api/onboarding/event` (so we know which card people drop off on, and which A/B variant performs best). Anonymized; never tied to your wallet balance or trade history.

You're automatically assigned variant A or B via a deterministic hash of your user id — the same user always sees the same variant across devices.
