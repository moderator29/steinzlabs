import {
  Wallet, KeyRound, Layers, Send, QrCode, Repeat, BookUser, ShieldCheck,
  Image as ImageIcon, History, Lock, EyeOff, FlaskConical, CreditCard,
  Usb, Plug, AlertTriangle, Globe,
} from 'lucide-react';

// Section 08 · Naka Wallet
// The built-in, fully non-custodial wallet. Every claim here is verified
// against lib/wallet/** and app/dashboard/wallet-page/**. No SNS (.sol name)
// resolution — only ENS is implemented, so it is NOT documented. Bitcoin is
// derivation-aware but send/receive is deferred, so it is framed honestly.

const CORE_FEATURES = [
  {
    icon: KeyRound, color: '#10B981',
    title: 'Create or import',
    desc: 'Generate a fresh 12-word seed in the browser, or import an existing BIP-39 phrase (12/15/18/21/24 words). The key is encrypted on your device with AES-256-GCM and a PBKDF2 key (100,000 rounds, SHA-256) derived from your password. Naka Labs never sees it.',
  },
  {
    icon: Layers, color: '#0066FF',
    title: 'Multi-account from one seed',
    desc: 'One seed phrase derives many accounts via BIP-44 — EVM at m/44’/60’/0’/0/i (MetaMask/Rabby-compatible) and Solana at m/44’/501’/i’/0’ (Phantom-compatible). Add accounts without a new backup; index 0 reproduces your original addresses exactly.',
  },
  {
    icon: Send, color: '#4D6BFF',
    title: 'Send & Receive',
    desc: 'Send and receive on EVM chains and Solana from one screen. EVM recipients can be entered as an ENS name (resolved live on Ethereum mainnet) or a raw address. Receive shows a scannable QR for the active chain.',
  },
  {
    icon: QrCode, color: '#8B5CF6',
    title: 'QR scanner',
    desc: 'Scan any payment address with your camera. The scanner reads ethereum:, solana: and bitcoin: URI schemes (including EIP-681), with an honest fallback when camera access is unavailable.',
  },
  {
    icon: Repeat, color: '#F59E0B',
    title: 'In-wallet swap',
    desc: 'Quote and start a swap without leaving the wallet — real routing via the 0x aggregator on EVM and Jupiter on Solana. You always confirm and sign the final transaction yourself.',
  },
  {
    icon: BookUser, color: '#0066FF',
    title: 'Address book',
    desc: 'Save recipients while sending and reuse them as quick-access contacts. Chain-aware and synced to your account so they follow you across devices.',
  },
  {
    icon: ShieldCheck, color: '#10B981',
    title: 'Approvals manager',
    desc: 'Scan your EVM token approvals (via Alchemy logs), see which contracts hold unlimited spend access, and revoke risky allowances in one click — approve(spender, 0) signed by you. EVM only; Solana has no ERC-20 allowance model.',
  },
  {
    icon: ImageIcon, color: '#8B5CF6',
    title: 'NFTs',
    desc: 'A unified NFT gallery across Ethereum, Polygon, Base, Arbitrum, Optimism (Alchemy) and Solana (Helius). One chain failing never blanks the whole view.',
  },
  {
    icon: History, color: '#6B7280',
    title: 'Transaction history',
    desc: 'A per-wallet activity view of your sends, receives, swaps and approvals with status, value and gas — backed by the database, not fabricated.',
  },
];

const SECURITY_FEATURES = [
  {
    icon: Lock, color: '#10B981',
    title: 'Auto-lock',
    desc: 'The decrypted key is held only in memory and evicted after an idle window (default 15 minutes; set your own minutes, or 0 to never auto-lock). It is also wiped when the tab is hidden or closed. The timer slides on each use so active trading won’t lock mid-flow.',
  },
  {
    icon: KeyRound, color: '#0066FF',
    title: 'Passkey unlock',
    desc: 'On supported devices you can unlock with a passkey (Face ID / Touch ID / Windows Hello). It uses WebAuthn with a PRF-derived key to unwrap your password locally — it never uploads your key, and it stays optional.',
  },
  {
    icon: EyeOff, color: '#F59E0B',
    title: 'Hide spam tokens',
    desc: 'Hide junk and airdropped spam tokens per-wallet from the Customize view. Your hidden list is yours; the underlying balances are never touched.',
  },
  {
    icon: FlaskConical, color: '#8B5CF6',
    title: 'Testnet mode',
    desc: 'Flip on testnet mode to use real public testnets (Sepolia, Base Sepolia, Arbitrum Sepolia, Polygon Amoy, BNB Testnet). Testnet coins have no USD value and are never priced as mainnet.',
  },
];

const ADVANCED = [
  {
    id: 'wallet-onramp',
    icon: CreditCard, color: '#10B981',
    title: 'Buy crypto with a card',
    desc: 'When the operator has configured a fiat on-ramp provider (Transak or MoonPay), you can buy crypto with a card and have it delivered straight to your wallet on the correct network — KYC and payment happen on the provider’s hosted widget. If no provider is configured the wallet shows an honest “not yet available” state rather than a fake flow.',
  },
  {
    id: 'wallet-ledger',
    icon: Usb, color: '#0066FF',
    title: 'Ledger hardware wallet',
    desc: 'Connect a Ledger over WebHID (desktop Chrome, Edge or Brave) to hold your keys on the device. EVM only: Naka reads your address and asks the device to sign each EIP-1559 transaction, which you confirm on the Ledger screen. The private key never leaves the hardware.',
  },
  {
    id: 'wallet-dapp',
    icon: Plug, color: '#8B5CF6',
    title: 'Use Naka as a wallet for any dApp',
    desc: 'Connect external dApps to your Naka wallet over WalletConnect and let Naka sign their requests — the reverse of plugging MetaMask into Naka. Supports personal_sign, typed-data (v4) and sendTransaction across the major EVM chains, with per-request approval that decrypts your key in the browser only. The blind-signing eth_sign method is blocked outright.',
  },
];

export function DocsSectionWallet() {
  return (
    <section id="naka-wallet" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">08</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Naka Wallet</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        A full non-custodial wallet built into Naka Labs — create or import a seed, hold and move funds across EVM chains and Solana, and connect hardware or external dApps · all without handing your keys to anyone. <span className="text-white font-semibold">You hold the keys. We never do.</span>
      </p>

      {/* Non-custodial framing */}
      <div id="wallet-custody" className="scroll-mt-20 nl-glass rounded-xl p-4 mb-8" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.22)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-[#10B981]" />
          <span className="text-sm font-semibold text-white">Non-custodial by design</span>
        </div>
        <ul className="space-y-2 text-xs text-gray-400 leading-relaxed">
          <li>— Your private key is generated and stored on your device, encrypted with your password using AES-256-GCM (PBKDF2, 100,000 rounds). Naka Labs has no copy.</li>
          <li>— There is no keyserver and no recovery by us. The <span className="text-white font-semibold">only</span> way to restore your wallet is the seed phrase shown at creation — write it down and store it offline before you fund anything.</li>
          <li>— Every transaction is signed locally and broadcast only after you approve it. The AI assistant can prepare a swap card but can never sign, move, or withdraw funds.</li>
        </ul>
      </div>

      {/* Core features */}
      <div id="wallet-basics" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#0066FF]" />The basics
        </h3>
        <div className="space-y-3">
          {CORE_FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex items-start gap-3 nl-glass rounded-xl p-4 hover:border-white/[0.10] transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-1">{title}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security & control */}
      <div id="wallet-security" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#10B981]" />Security &amp; control
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECURITY_FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="nl-glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                <div className="text-sm font-semibold text-white">{title}</div>
              </div>
              <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced connections */}
      <div id="wallet-advanced" className="scroll-mt-20 mb-8">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Plug className="w-4 h-4 text-[#0066FF]" />Fiat, hardware &amp; dApps
        </h3>
        <div className="space-y-3">
          {ADVANCED.map(({ id, icon: Icon, color, title, desc }) => (
            <div id={id} key={id} className="scroll-mt-20 flex items-start gap-3 nl-glass rounded-xl p-4 hover:border-white/[0.10] transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-1">{title}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supported chains note */}
      <div className="nl-glass rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-[#4D6BFF]" />
          <span className="text-sm font-semibold text-white">Supported chains</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche and Solana ship enabled, with many more EVM networks addable from <span className="text-white font-semibold">Add Network</span>. Bitcoin appears in the network list but send/receive is not live yet — the Receive panel shows an honest “coming&nbsp;soon” state rather than a wrong address.
        </p>
      </div>

      {/* Risk note */}
      <div className="flex items-start gap-2 p-3 bg-[#F59E0B]/[0.05] border border-[#F59E0B]/20 rounded-xl">
        <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 leading-relaxed">
          A self-custody wallet puts you in full control — which also means there is no support line that can reverse a transaction or recover a lost seed phrase. Back up your seed offline, double-check every address before you send, and only keep what you are prepared to manage yourself.
        </p>
      </div>
    </section>
  );
}
