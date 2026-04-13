import {
  Brain, Shield, Zap, Network, TrendingUp, BarChart2,
  Fingerprint, Target, type LucideIcon,
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
    description: 'Real-time whale tracking, smart money flows, and wallet DNA analysis across 12+ chains. See what institutions see, before they move.',
    bullets: ['Whale wallet movements in real time', 'Smart money convergence signals', 'Wallet DNA profiling and archetypes', 'Cluster and insider detection'],
    pills: ['Whale Tracking', 'Smart Money', 'DNA Profiles', 'Entity Labels'],
    badge: 'AI_POWERED',
    badgePosition: 'top-right',
    icon: Brain,
    gradient: 'linear-gradient(135deg,#0A1EFF 0%,#0c22e0 50%,#050ea8 100%)',
    cta: 'Start Analyzing →', href: '/dashboard',
  },
  {
    tag: 'For Security', title: 'Shadow Guardian Protection',
    description: 'AI-powered scam detection on every transaction. Token safety scanner, rug detector, domain shield, and signature insight — all built-in.',
    bullets: ['Honeypot simulation before every swap', 'Deployer history and rug probability scoring', 'Phishing domain detection and blocking', 'Token approval risk manager'],
    pills: ['Honeypot Detection', 'Rug Scanner', 'Phishing Shield', 'Approvals'],
    icon: Shield,
    gradient: 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)',
    cta: 'Scan Any Token →', href: '/dashboard/security',
  },
  {
    tag: 'For DeFi', title: 'Multi-Chain Swap Engine',
    description: 'Trade across Ethereum, Solana, BNB, Base, Arbitrum, and more. Every swap is automatically screened before execution. Best route. Best price.',
    bullets: ['Automatic security scan on every swap', 'MEV protection and sandwich attack prevention', 'Best route aggregation across all DEXes', '0.15% platform fee — transparent and fair'],
    pills: ['Security Scan', 'MEV Protection', 'Best Route', '0.15% Fee'],
    icon: Zap,
    gradient: 'linear-gradient(135deg,#4c1d95 0%,#5b21b6 50%,#6d28d9 100%)',
    cta: 'Trade Now →', href: '/dashboard/swap',
  },
  {
    tag: 'For Research', title: 'Bubble Map Intelligence',
    description: 'Visualize wallet networks, token holder distributions, and smart money flows. See who is connected to who, and what they are doing together.',
    bullets: ['Complete token holder distribution maps', 'Wallet cluster and coordination detection', 'Arkham-powered entity labeling on every node', 'Smart money flow visualization'],
    pills: ['Cluster Detection', 'Whale Networks', 'Token Flows', 'Entity Mapping'],
    badge: 'NEW',
    badgePosition: 'top-left',
    icon: Network,
    gradient: 'linear-gradient(135deg,#0F4C75 0%,#1B6CA8 100%)',
    cta: 'Explore Networks →', href: '/dashboard/bubble-map',
  },
  {
    tag: 'For Alpha', title: 'Smart Money + Whale Tracker',
    description: 'Follow the wallets that consistently win. When multiple smart money wallets enter the same token simultaneously — we alert you first.',
    bullets: ['Real-time feed of large wallet movements', 'High conviction signals when 3+ smart wallets converge', 'Arkham entity labels on every whale move', 'Personal whale watchlist with instant alerts'],
    pills: ['Real-time Feed', 'Convergence Signals', 'Entity Labels', 'Watchlist'],
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg,#92400E 0%,#D97706 100%)',
    cta: 'Track Whales →', href: '/dashboard/whale-tracker',
  },
  {
    tag: 'Automated', title: 'Sniper Bot',
    description: 'Automated new token detection with mandatory security scanning. Every execution passes a 5-step safety protocol before any capital moves.',
    bullets: ['Monitors all new Solana and EVM token launches', '6-layer security check before ANY execution', 'Auto-blocks honeypots, rugs, and high-risk contracts', 'Fully configurable risk thresholds and position sizes'],
    pills: ['5-Layer Safety', 'Auto-block', 'SOL + EVM', 'Config Risk'],
    badge: 'LIVE',
    badgePosition: 'top-right',
    icon: Target,
    gradient: 'linear-gradient(135deg,#1a0505 0%,#7F1D1D 50%,#991B1B 100%)',
    cta: 'Configure Bot →', href: '/dashboard/sniper',
  },
  {
    tag: 'For Intelligence', title: 'On-Chain Trend Detection',
    description: 'Know what is trending before Twitter does. We measure unique wallet growth, volume spikes, and social momentum — combined into one signal.',
    bullets: ['Momentum detection via unique wallet growth', 'Social sentiment from LunarCrush (4-key live data)', 'Emerging narrative identification across all chains', 'New launches gaining organic traction (under 7 days)'],
    pills: ['Momentum Detection', 'Social Sentiment', 'New Launches', 'Narrative ID'],
    icon: BarChart2,
    gradient: 'linear-gradient(135deg,#312E81 0%,#7C3AED 100%)',
    cta: 'See Trends →', href: '/dashboard/trends',
  },
  {
    tag: 'For Research', title: 'Wallet Intelligence DNA',
    description: 'Full behavioral profiles for any wallet. Entity labeling, cluster detection, and complete PnL history across all chains.',
    bullets: ['Complete transaction history analysis', 'Entity labeling and cluster affiliations', 'Win rate and PnL calculations', 'Trading archetype classification'],
    pills: ['Diamond Hands', 'Smart Money', 'Whale', 'Degen'],
    icon: Fingerprint,
    gradient: 'linear-gradient(135deg,#0a1050 0%,#050830 100%)',
    cta: 'Analyze Wallet →', href: '/dashboard',
  },
  {
    tag: 'Market', title: 'Market Intelligence',
    description: 'Real-time prices, social sentiment, trending tokens, and whale movement alerts — all in one terminal.',
    bullets: ['Live price feeds across all chains', 'Social momentum and sentiment scoring', 'Trending token detection and alerts', 'Whale movement notifications in real time'],
    pills: ['Price Data', 'Social Signals', 'On-Chain', 'Entity Intel'],
    icon: BarChart2,
    gradient: 'linear-gradient(135deg,#0a0a2e 0%,#050518 100%)',
    cta: 'Open Market →', href: '/market',
  },
];
