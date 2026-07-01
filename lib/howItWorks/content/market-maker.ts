import type { HowItWorksContent } from '@/lib/howItWorks/types';

export const marketMakerHowItWorks: HowItWorksContent = {
  title: 'Market Maker',
  tagline: 'Run automated grid and range strategies that quote both sides of a token, fully non-custodial.',
  howItWorks: [
    'Market Maker lets you stand up an automated two-sided strategy on a token: you choose a chain and paste a token address, and the engine builds a ladder of buy rungs below and sell rungs above a reference price, spaced from your spread at the closest rung out to your band at the furthest.',
    'The reference price either tracks the live market mid from DexScreener or stays fixed at a manual value you set, and the token symbol on the create screen is resolved from real on-chain metadata so you know you have the right asset before you commit.',
    'A Grid strategy places a symmetric ladder that accumulates as price falls into your buy rungs and distributes as it rises into your sell rungs, while a Range strategy is simpler: it accumulates at or below a lower bound and distributes at or above an upper bound, both measured relative to the reference.',
    'Every fill runs through a capped, expiring session key on supported EVM chains, so the engine can place swaps for you while your main wallet keys stay in your browser, and each pass is conservative, taking at most one action per tick and honoring your order size, total budget, inventory cap, and maximum slippage.',
    'On-chain trade routing uses live USDC pricing and exact fill amounts from the executed quote, so inventory and realized profit and loss reflect what actually settled on chain rather than estimates.',
    'Each strategy card reports its current status, spend measured against your budget as a progress bar, the token inventory it is holding, and realized profit and loss, with the inventory shown in tokens and a rough USD figure only when you priced the grid off a manual reference.',
    'Guards built into the engine refuse to trade when a manual reference has drifted far from the live market and re-arm a given rung at most once per window, so a one-directional move cannot drain your whole budget into a single falling level.',
  ],
  howToUse: [
    'Open Market Maker and review the active strategy count and the non-custodial notice in the header, then tap New Strategy to start configuring.',
    'Pick the chain from the supported list and paste the token address, then wait for the symbol to resolve so you can confirm you have the correct token on that chain.',
    'Choose Grid or Range, and for Range set the lower and upper bound percentages that define where you accumulate and where you distribute.',
    'Select Market to price the grid off the live DexScreener mid, or Manual to pin a fixed reference price you control, then set your spread, levels per side, band, order size, budget, maximum inventory, and maximum slippage.',
    'Read the ladder preview to sanity-check the rungs the engine will place, shown as real prices when you set a manual reference or as relative multiples of the reference when pricing off the market.',
    'Create the strategy, which starts paused so nothing trades until you fund your session-key account on that chain from the setup card and then activate it.',
    'Use Activate, Pause, or Stop on any card to control a strategy instantly, and tap Refresh to pull the latest spend, inventory, and profit and loss numbers.',
  ],
  why: [
    'Automated two-sided quoting lets you provide liquidity and capture spread on a token without sitting on the order book yourself, turning a repetitive manual task into a strategy you configure once and supervise.',
    'Reach for it when you want passive accumulation and distribution around a price you believe in, or when you want to earn the spread on a token you already follow, and let the engine work it tick by tick.',
    'Hard limits on order size, budget, inventory, and slippage, plus an instant pause or stop on every card, keep risk bounded and reversible at all times, which matters because market making can lose money to impermanent loss, adverse selection, and gas.',
    'Because execution flows through a capped, revocable session key while your main keys never leave your device, the strategy fits a non-custodial workflow where you can pair it with the rest of the platform for research and monitoring without handing over custody.',
  ],
  whatsNew: [
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Inventory and realized profit and loss now reflect the exact on-chain fill amounts from each executed quote rather than price estimates.',
    },
    {
      date: '2026',
      tag: 'IMPROVED',
      text: 'Added a Range strategy alongside Grid, accumulating at or below a lower bound and distributing at or above an upper bound, plus rung re-arm and stale-reference guards that stop a one-directional move from draining the budget.',
    },
    {
      date: '2026',
      tag: 'NEW',
      text: 'Configure non-custodial grid market-making strategies with a live ladder preview, real token-symbol resolution, and instant pause or stop controls.',
    },
  ],
};
