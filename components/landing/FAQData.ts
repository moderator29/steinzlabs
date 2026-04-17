export interface FAQ { q: string; a: string; }

export const FAQS: FAQ[] = [
  {
    q: 'What is Naka Labs?',
    a: 'Naka Labs is an institutional-grade crypto intelligence platform. We combine on-chain data, AI analysis, and real-time market intelligence to give traders and researchers the same tools that professional trading firms use — but accessible to everyone. Analyze tokens, track whale wallets, detect rugs, and execute trades across 12+ blockchains from one dashboard.',
  },
  {
    q: 'How does the VTX Intelligence Engine work?',
    a: 'VTX is Naka Labs\' AI analysis layer, powered by Anthropic\'s Claude. When you submit a token address or wallet, VTX pulls real-time data from multiple sources simultaneously — on-chain transaction data, security scores, social sentiment, and liquidity analysis — then synthesizes everything into a structured intelligence report with a risk score and clear recommendation.',
  },
  {
    q: 'Is my wallet data private and secure?',
    a: 'Naka Labs is non-custodial. We never ask for your private keys, seed phrase, or signing permissions for read-only analysis. When you connect a wallet for trading, transactions are signed client-side — your keys never leave your device. We only read publicly available on-chain data to generate intelligence reports.',
  },
  {
    q: 'How does the Security Center detect rug pulls?',
    a: 'Our Security Center runs a multi-layer analysis on every token: honeypot simulation, deployer wallet history (how many previous tokens, how many failed), liquidity lock verification, owner privilege detection (can they mint, blacklist, or pause trading), and holder concentration analysis. Any token that fails these checks is flagged before you ever see a swap button.',
  },
  {
    q: 'What is the Sniper Bot and how does it protect users?',
    a: 'The Sniper Bot monitors new token launches in real time and automatically executes buys on tokens that pass all safety checks. Before any execution, it runs a security pre-screen, full security analysis, transaction simulation, and economic evaluation. It will NEVER execute on a token that fails any of these layers — your capital is protected by design.',
  },
  {
    q: 'How does Naka Labs make money?',
    a: 'Naka Labs charges a 0.15% platform fee on swaps executed through our swap engine. This is lower than most DEX aggregators. There are no monthly subscription fees, no data fees, and no hidden charges. All fee amounts are shown transparently before you confirm any transaction.',
  },
  {
    q: 'What makes Naka Labs different from other crypto platforms?',
    a: 'Most platforms show you data. Naka Labs gives you intelligence. The difference is synthesis — instead of showing raw numbers, our VTX engine combines on-chain data, security analysis, social sentiment, and entity intelligence (powered by Arkham) into a single, actionable report. We also integrate with institutional-grade tools like Arkham entity labeling, which tells you exactly WHO owns the wallets you are analyzing.',
  },
  {
    q: 'What blockchains does Naka Labs support?',
    a: 'Naka Labs supports 12+ chains including Ethereum, Solana, BNB Chain, Base, Arbitrum, Optimism, Polygon, and Avalanche. The swap engine covers Solana via Jupiter/Raydium, and EVM chains via Uniswap v3/v4, 0x Protocol, and Alchemy routing. New chains are added regularly.',
  },
  {
    q: 'How does the Bubble Map work?',
    a: 'The Bubble Map pulls holder data for any token and renders a visual network graph showing wallet distribution. Each node represents a wallet cluster, sized by holdings. Arkham entity labels are overlaid where available — so you can instantly see if exchanges, funds, or known whales hold large positions. Connections show transfer relationships between clusters.',
  },
  {
    q: 'What is the DNA Analyzer?',
    a: 'The DNA Analyzer profiles any wallet by analyzing its entire transaction history. It assigns a trading archetype (Degen, Diamond Hand, Smart Money, etc.), calculates win rate and average PnL, identifies favorite chains and trading patterns, and detects cluster affiliations. This tells you not just what a wallet holds, but how it trades.',
  },
  {
    q: 'What is smart money tracking and how does it work?',
    a: 'Smart money wallets are identified by sustained >65% win rate on token trades over 90+ days with meaningful volume. Our system monitors these wallets in real time and fires a high-conviction signal when 3 or more smart money wallets enter the same token within a 24-hour window — a historically reliable indicator of upcoming price action.',
  },
  {
    q: 'How does the Whale Tracker know who the whales are?',
    a: 'Whale identification uses two layers: transaction size threshold (>$50k single swap triggers a flag) and Arkham Intelligence entity labeling. Arkham provides named entity data for thousands of known wallets — exchanges, VC funds, market makers, and notable traders. When a labeled wallet makes a large move, you see the entity name, not just an address.',
  },
  {
    q: 'What chains does the swap engine support and how does routing work?',
    a: 'The swap engine supports Solana (via Jupiter aggregator and Raydium), Ethereum, Base, Arbitrum, BNB Chain, and Polygon (via Uniswap v3/v4 and 0x Protocol routing). For each swap, the engine queries multiple routes simultaneously, compares output amounts after fees and slippage, then executes on the best path. A security scan runs automatically before any route is shown to you.',
  },
  {
    q: 'How do price alerts work?',
    a: 'Price alerts are stored in Supabase with your target price, direction (above/below), and token address. A server-side evaluation loop polls live price data every minute and triggers when your condition is met. Notifications are sent via Resend email. You can set up to 20 active alerts on the Pro plan.',
  },
  {
    q: 'Can I use Naka Labs without connecting a wallet?',
    a: 'Yes — the majority of features are fully read-only. You can use the Context Feed, Security Center scanner, Whale Tracker, Smart Money Feed, DNA Analyzer, Bubble Map, VTX AI, and Research pages without connecting any wallet. A wallet connection is only required for: executing swaps, running the Sniper Bot, and tracking your own portfolio.',
  },
  {
    q: 'How do I set up and configure the Sniper Bot?',
    a: 'Navigate to Dashboard → Sniper Bot → Settings. Configure your max buy amount per token, maximum risk score threshold (0–100), chains to monitor (Solana, ETH, Base), and optional stop-loss percentage. The bot will only execute on tokens scoring below your risk threshold. All 6 safety layers run automatically — you cannot disable them. Start/stop the bot from the Sniper Oversight panel.',
  },
];
