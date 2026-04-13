import { Brain, Shield, Zap, Network, TrendingUp, Crosshair, BarChart2, type LucideIcon } from 'lucide-react';

export interface CardData {
  tag: string; title: string; description: string; bullets: string[];
  icon: LucideIcon; gradient: string; cta: string; href: string;
}

export const FEATURE_CARDS: CardData[] = [
  {
    tag: 'For Traders', title: 'On-Chain Intelligence Engine',
    description: 'Real-time whale tracking, smart money flows, and wallet DNA analysis across 12+ chains. See what institutions see, before they move.',
    bullets: ['Whale wallet movements in real time', 'Smart money convergence signals', 'Wallet DNA profiling and archetypes', 'Cluster and insider detection'],
    icon: Brain,
    gradient: 'linear-gradient(135deg,#0A1EFF 0%,#0c22e0 50%,#050ea8 100%)',
    cta: 'Start Analyzing →', href: '/dashboard',
  },
  {
    tag: 'For Security', title: 'Shadow Guardian Protection',
    description: 'AI-powered scam detection on every transaction. Token safety scanner, rug detector, domain shield, and signature insight — all built-in.',
    bullets: ['Honeypot simulation before every swap', 'Deployer history and rug probability scoring', 'Phishing domain detection and blocking', 'Token approval risk manager'],
    icon: Shield,
    gradient: 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)',
    cta: 'Scan Any Token →', href: '/dashboard/security',
  },
  {
    tag: 'For DeFi', title: 'Multi-Chain Swap Engine',
    description: 'Trade across Ethereum, Solana, BNB, Base, Arbitrum, and more. Every swap is automatically screened before execution. Best route. Best price.',
    bullets: ['Automatic security scan on every swap', 'MEV protection and sandwich attack prevention', 'Best route aggregation across all DEXes', '0.15% platform fee — transparent and fair'],
    icon: Zap,
    gradient: 'linear-gradient(135deg,#4c1d95 0%,#5b21b6 50%,#6d28d9 100%)',
    cta: 'Trade Now →', href: '/dashboard/swap',
  },
  {
    tag: 'For Research', title: 'Bubble Map Intelligence',
    description: 'Visualize wallet networks, token holder distributions, and smart money flows. See who is connected to who, and what they are doing together.',
    bullets: ['Complete token holder distribution maps', 'Wallet cluster and coordination detection', 'Arkham-powered entity labeling on every node', 'Smart money flow visualization'],
    icon: Network,
    gradient: 'linear-gradient(135deg,#0F4C75 0%,#1B6CA8 100%)',
    cta: 'Explore Networks →', href: '/dashboard/bubble-map',
  },
  {
    tag: 'For Alpha', title: 'Smart Money + Whale Tracker',
    description: 'Follow the wallets that consistently win. When multiple smart money wallets enter the same token simultaneously — we alert you first.',
    bullets: ['Real-time feed of large wallet movements', 'High conviction signals when 3+ smart wallets converge', 'Arkham entity labels on every whale move', 'Personal whale watchlist with instant alerts'],
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg,#92400E 0%,#D97706 100%)',
    cta: 'Track Whales →', href: '/dashboard/whale-tracker',
  },
  {
    tag: 'For Snipers', title: 'Automated Sniper Bot',
    description: 'Never miss a launch. Our sniper bot detects new tokens and runs a 6-layer safety check before executing — so you only buy what is safe.',
    bullets: ['Monitors all new Solana and EVM token launches', '6-layer security check before ANY execution', 'Auto-blocks honeypots, rugs, and high-risk contracts', 'Fully configurable risk thresholds and position sizes'],
    icon: Crosshair,
    gradient: 'linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%)',
    cta: 'Configure Bot →', href: '/dashboard/sniper',
  },
  {
    tag: 'For Intelligence', title: 'On-Chain Trend Detection',
    description: 'Know what is trending before Twitter does. We measure unique wallet growth, volume spikes, and social momentum — combined into one signal.',
    bullets: ['Momentum detection via unique wallet growth', 'Social sentiment from LunarCrush (4-key live data)', 'Emerging narrative identification across all chains', 'New launches gaining organic traction (under 7 days)'],
    icon: BarChart2,
    gradient: 'linear-gradient(135deg,#312E81 0%,#7C3AED 100%)',
    cta: 'See Trends →', href: '/dashboard/trends',
  },
];
