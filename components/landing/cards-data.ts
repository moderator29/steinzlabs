import {
  Brain, Shield, Zap, Network, TrendingUp, BarChart2,
  Fingerprint, Target, LineChart, type LucideIcon,
} from 'lucide-react';
import type { BadgeType } from './ContainerBadge';

export interface CardData {
  tag: string; title: string; description: string; bullets: string[];
  pills?: string[];
  badge?: BadgeType;
  badgePosition?: 'top-right' | 'top-left';
  icon: LucideIcon; gradient: string; cta: string; href: string;
}

export const FEATURE_CARDS: CardData[] = [
  {
    tag: 'For Traders', title: 'On-Chain Intelligence Engine',
    description: 'Real-time whale tracking, smart-money flows, and wallet DNA across EVM + Solana.',
    bullets: ['Whale movements in real time', 'Smart-money convergence signals', 'Wallet DNA + insider detection'],
    pills: ['Whale Tracking', 'Smart Money', 'DNA Profiles'],
    badge: 'AI_POWERED',
    badgePosition: 'top-right',
    icon: Brain,
    gradient: 'linear-gradient(135deg,#0066FF 0%,#0c22e0 50%,#050ea8 100%)',
    cta: 'Start Analyzing →', href: '/dashboard',
  },
  {
    tag: 'For Security', title: 'Shadow Guardian Protection',
    description: 'AI scam detection on every transaction — honeypot, rug, and phishing checks built in.',
    bullets: ['Honeypot simulation before every swap', 'Deployer history + rug scoring', 'Phishing domain blocking'],
    pills: ['Honeypot', 'Rug Scanner', 'Phishing Shield'],
    icon: Shield,
    gradient: 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)',
    cta: 'Scan Any Token →', href: '/dashboard/security',
  },
  {
    tag: 'For DeFi', title: 'Multi-Chain Swap Engine',
    description: 'Trade across EVM + Solana with a security scan on every swap. Best route, best price.',
    bullets: ['Security scan on every swap', 'MEV / sandwich protection', '0.5% platform fee — transparent'],
    pills: ['Security Scan', 'MEV Protection', '0.5% Fee'],
    icon: Zap,
    gradient: 'linear-gradient(135deg,#4c1d95 0%,#5b21b6 50%,#6d28d9 100%)',
    cta: 'Trade Now →', href: '/dashboard/swap',
  },
  {
    tag: 'For Research', title: 'Bubble Map Intelligence',
    description: 'Visualize wallet networks, holder distributions, and how smart money connects.',
    bullets: ['Token holder distribution maps', 'Cluster + coordination detection', 'Entity labels on every node'],
    pills: ['Clusters', 'Whale Networks', 'Entity Mapping'],
    badge: 'NEW',
    badgePosition: 'top-left',
    icon: Network,
    gradient: 'linear-gradient(135deg,#0F4C75 0%,#1B6CA8 100%)',
    cta: 'Explore Networks →', href: '/dashboard/bubble-map',
  },
  {
    tag: 'For Alpha', title: 'Smart Money + Whale Tracker',
    description: 'Follow the wallets that consistently win — and get alerted when they converge.',
    bullets: ['Real-time large-wallet feed', 'Signals when 3+ smart wallets converge', 'Personal whale watchlist + alerts'],
    pills: ['Live Feed', 'Convergence', 'Watchlist'],
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg,#92400E 0%,#D97706 100%)',
    cta: 'Track Whales →', href: '/dashboard/whale-tracker',
  },
  {
    tag: 'Automated', title: 'Sniper Bot',
    description: 'Automated new-token detection with a mandatory security gate before any capital moves.',
    bullets: ['Monitors new SOL + EVM launches', '6-layer check before execution', 'Auto-blocks honeypots and rugs'],
    pills: ['6-Layer Safety', 'Auto-block', 'SOL + EVM'],
    badge: 'LIVE',
    badgePosition: 'top-right',
    icon: Target,
    gradient: 'linear-gradient(135deg,#1a0505 0%,#7F1D1D 50%,#991B1B 100%)',
    cta: 'Configure Bot →', href: '/dashboard/sniper',
  },
  {
    tag: 'Automated', title: 'Market Maker Bot',
    description: 'Non-custodial automated market making — work a spread around a token with bounded, capped two-sided swaps.',
    bullets: ['Grid + Range strategies', 'Budget, inventory + slippage caps you sign for', 'Net PnL tracking · pause/stop kill switch'],
    pills: ['Non-Custodial', 'Grid + Range', 'Capped'],
    badge: 'NEW',
    badgePosition: 'top-right',
    icon: LineChart,
    gradient: 'linear-gradient(135deg,#0b1f4d 0%,#0c22e0 55%,#050ea8 100%)',
    cta: 'Open Market Maker →', href: '/dashboard/market-maker',
  },
  {
    tag: 'For Intelligence', title: 'On-Chain Trend Detection',
    description: 'Catch momentum before Twitter — unique-wallet growth, volume, and social in one signal.',
    bullets: ['Momentum via unique-wallet growth', 'Live social sentiment (LunarCrush)', 'Early launches gaining traction'],
    pills: ['Momentum', 'Social Sentiment', 'New Launches'],
    icon: BarChart2,
    gradient: 'linear-gradient(135deg,#312E81 0%,#7C3AED 100%)',
    cta: 'See Trends →', href: '/dashboard/trends',
  },
  {
    tag: 'For Research', title: 'Wallet Intelligence DNA',
    description: 'Full behavioral profiles for any wallet — entity labels, clusters, and PnL history.',
    bullets: ['Transaction history analysis', 'Entity labels + cluster affiliations', 'Win rate, PnL + archetype'],
    pills: ['Smart Money', 'Whale', 'Degen'],
    icon: Fingerprint,
    gradient: 'linear-gradient(135deg,#0a1050 0%,#050830 100%)',
    cta: 'Analyze Wallet →', href: '/dashboard',
  },
  {
    tag: 'Market', title: 'Market Intelligence',
    description: 'Live prices, social sentiment, trending tokens, and whale alerts in one terminal.',
    bullets: ['Live price feeds across chains', 'Social momentum scoring', 'Trending + whale alerts'],
    pills: ['Price Data', 'Social Signals', 'Entity Intel'],
    icon: BarChart2,
    gradient: 'linear-gradient(135deg,#0a0a2e 0%,#050518 100%)',
    cta: 'Open Market →', href: '/market',
  },
];
