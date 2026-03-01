'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Download, Send, Copy, Eye, EyeOff, RefreshCw, Trash2, ChevronRight, Wallet, Key, Shield, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string | null;
  contractAddress: string | null;
  logo?: string;
}

interface WalletData {
  address: string;
  ethBalance: string;
  totalBalanceUsd: string;
  holdings: TokenBalance[];
  tokenCount: number;
}

interface StoredWallet {
  address: string;
  encryptedKey: string;
  name: string;
  createdAt: string;
}

function simpleEncrypt(text: string, password: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return btoa(result);
}

function simpleDecrypt(encoded: string, password: string): string {
  const text = atob(encoded);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return result;
}

export default function WalletPage() {
  const [view, setView] = useState<'main' | 'create' | 'import' | 'send' | 'receive' | 'add-token'>('main');
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<StoredWallet | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [customTokens, setCustomTokens] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('steinz_wallets');
    if (stored) {
      const parsed = JSON.parse(stored);
      setWallets(parsed);
      if (parsed.length > 0) setActiveWallet(parsed[0]);
    }
    const tokens = localStorage.getItem('steinz_custom_tokens');
    if (tokens) setCustomTokens(JSON.parse(tokens));
  }, []);

  const saveWallets = (w: StoredWallet[]) => {
    setWallets(w);
    localStorage.setItem('steinz_wallets', JSON.stringify(w));
  };

  const fetchBalances = useCallback(async (address: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wallet-intelligence?address=${address}&chain=ethereum`);
      if (res.ok) {
        const data = await res.json();
        setWalletData(data);

        try {
          const existing = JSON.parse(localStorage.getItem('steinz_portfolio_wallet') || '""');
          if (existing !== address) {
            localStorage.setItem('steinz_portfolio_wallet', JSON.stringify(address));
            localStorage.setItem('wallet_address', address);
            localStorage.setItem('wallet_provider', 'builtin');
            window.dispatchEvent(new CustomEvent('steinz_wallet_changed'));
          }
        } catch {}
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeWallet) fetchBalances(activeWallet.address);
  }, [activeWallet, fetchBalances]);

  const handleWalletCreated = (wallet: StoredWallet) => {
    const updated = [...wallets, wallet];
    saveWallets(updated);
    setActiveWallet(wallet);
    setView('main');
  };

  const removeWallet = (addr: string) => {
    const updated = wallets.filter(w => w.address !== addr);
    saveWallets(updated);
    if (activeWallet?.address === addr) {
      setActiveWallet(updated[0] || null);
      setWalletData(null);
    }
  };

  if (view === 'create') return <CreateWalletView onBack={() => setView('main')} onCreated={handleWalletCreated} />;
  if (view === 'import') return <ImportWalletView onBack={() => setView('main')} onImported={handleWalletCreated} />;
  if (view === 'send' && activeWallet) return <SendView onBack={() => setView('main')} wallet={activeWallet} />;
  if (view === 'receive' && activeWallet) return <ReceiveView onBack={() => setView('main')} address={activeWallet.address} />;
  if (view === 'add-token') return <AddTokenView onBack={() => setView('main')} tokens={customTokens} onAdd={(t) => { const updated = [...customTokens, t]; setCustomTokens(updated); localStorage.setItem('steinz_custom_tokens', JSON.stringify(updated)); setView('main'); }} />;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-heading font-bold">STEINZ Wallet</h1>
              <p className="text-gray-400 text-[10px]">Non-custodial Ethereum wallet</p>
            </div>
          </div>
          <button onClick={() => activeWallet && fetchBalances(activeWallet.address)} disabled={loading} className="p-2 hover:bg-white/10 rounded-lg">
            <RefreshCw className={`w-4 h-4 text-[#00E5FF] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-[#00E5FF]/10 to-[#7C3AED]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-10 h-10 text-[#00E5FF]" />
            </div>
            <h2 className="text-lg font-bold mb-2">Get Started</h2>
            <p className="text-gray-400 text-sm mb-6">Create a new wallet or import an existing one using your recovery phrase or private key.</p>
            <div className="space-y-3">
              <button onClick={() => setView('create')} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Create New Wallet
              </button>
              <button onClick={() => setView('import')} className="w-full py-3 border border-white/10 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/5">
                <Download className="w-4 h-4" /> Import Wallet
              </button>
            </div>
            <div className="mt-6 p-3 bg-[#111827] rounded-xl border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-[10px] font-semibold text-[#10B981]">Non-Custodial</span>
              </div>
              <p className="text-[10px] text-gray-500">Your keys stay on your device. STEINZ never has access to your private keys or funds.</p>
            </div>
          </div>
        ) : (
          <>
            {wallets.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {wallets.map(w => (
                  <button
                    key={w.address}
                    onClick={() => setActiveWallet(w)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
                      activeWallet?.address === w.address ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'
                    }`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}

            <div className="glass rounded-2xl p-5 border border-white/10 mb-4">
              <div className="text-center mb-4">
                <p className="text-gray-400 text-xs mb-1">Total Balance</p>
                <p className="text-3xl font-bold font-mono">
                  {loading ? '...' : walletData ? `$${parseFloat(walletData.totalBalanceUsd).toLocaleString()}` : '$0.00'}
                </p>
                <p className="text-gray-500 text-[10px] font-mono mt-1">
                  {activeWallet?.address.slice(0, 6)}...{activeWallet?.address.slice(-4)}
                  <button onClick={() => { navigator.clipboard.writeText(activeWallet?.address || ''); }} className="ml-1 inline-flex"><Copy className="w-3 h-3 text-gray-500 hover:text-white" /></button>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setView('send')} className="py-2.5 bg-[#111827] rounded-xl text-xs font-semibold flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
                  <Send className="w-4 h-4 text-[#00E5FF]" /> Send
                </button>
                <button onClick={() => setView('receive')} className="py-2.5 bg-[#111827] rounded-xl text-xs font-semibold flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
                  <Download className="w-4 h-4 text-[#10B981]" /> Receive
                </button>
                <button onClick={() => setView('add-token')} className="py-2.5 bg-[#111827] rounded-xl text-xs font-semibold flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
                  <Plus className="w-4 h-4 text-[#7C3AED]" /> Add Token
                </button>
              </div>
            </div>

            <div className="glass rounded-xl border border-white/10 overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-bold">Holdings</h3>
                <span className="text-[10px] text-gray-500">{walletData?.tokenCount || 0} tokens</span>
              </div>
              {walletData?.holdings && walletData.holdings.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {walletData.holdings.map((token, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center">
                          <span className="text-[10px] font-bold">{token.symbol.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{token.symbol}</p>
                          <p className="text-[10px] text-gray-500">{token.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono">{token.balance}</p>
                        {token.valueUsd && <p className="text-[10px] text-gray-500">${parseFloat(token.valueUsd).toLocaleString()}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-gray-500 text-xs">
                  {loading ? 'Loading...' : 'No tokens found'}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setView('create')} className="flex-1 py-2 border border-white/10 rounded-lg text-xs font-semibold hover:bg-white/5 flex items-center justify-center gap-1">
                <Plus className="w-3 h-3" /> New Wallet
              </button>
              <button onClick={() => setView('import')} className="flex-1 py-2 border border-white/10 rounded-lg text-xs font-semibold hover:bg-white/5 flex items-center justify-center gap-1">
                <Download className="w-3 h-3" /> Import
              </button>
              <button onClick={() => activeWallet && removeWallet(activeWallet.address)} className="py-2 px-3 border border-[#EF4444]/20 text-[#EF4444] rounded-lg text-xs font-semibold hover:bg-[#EF4444]/10">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {activeWallet && (
              <a
                href={`https://etherscan.io/address/${activeWallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full py-2 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
              >
                View on Etherscan <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CreateWalletView({ onBack, onCreated }: { onBack: () => void; onCreated: (w: StoredWallet) => void }) {
  const [step, setStep] = useState<'password' | 'phrase' | 'confirm'>('password');
  const [password, setPassword] = useState('');
  const [walletName, setWalletName] = useState('Wallet 1');
  const [mnemonic, setMnemonic] = useState('');
  const [address, setAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [creating, setCreating] = useState(false);

  const createWallet = async () => {
    if (!password || password.length < 6) return;
    setCreating(true);
    try {
      const ethers = await import('ethers');
      const wallet = ethers.Wallet.createRandom();
      setMnemonic(wallet.mnemonic?.phrase || '');
      setAddress(wallet.address);
      setPrivateKey(wallet.privateKey);
      setStep('phrase');
    } catch (e) {
      console.error('Wallet creation error:', e);
    } finally {
      setCreating(false);
    }
  };

  const confirmAndSave = () => {
    const encrypted = simpleEncrypt(privateKey, password);
    onCreated({
      address,
      encryptedKey: encrypted,
      name: walletName,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-1">Create New Wallet</h1>
        <p className="text-gray-400 text-xs mb-6">Your keys, your crypto. Fully non-custodial.</p>

        {step === 'password' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Wallet Name</label>
              <input value={walletName} onChange={e => setWalletName(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Set Password (min 6 chars)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="Secure password to encrypt your keys" />
            </div>
            <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span className="text-[10px] font-semibold text-[#F59E0B]">Important</span>
              </div>
              <p className="text-[10px] text-gray-400">This password encrypts your private key locally. If you lose it, you can only recover your wallet with the recovery phrase.</p>
            </div>
            <button onClick={createWallet} disabled={password.length < 6 || creating} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
              {creating ? 'Generating...' : 'Generate Wallet'}
            </button>
          </div>
        )}

        {step === 'phrase' && (
          <div className="space-y-4">
            <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <span className="text-xs font-bold text-[#EF4444]">Write Down Your Recovery Phrase</span>
              </div>
              <p className="text-[10px] text-gray-400">This is the ONLY way to recover your wallet. Write it down and store it safely. Never share it with anyone.</p>
            </div>

            <div className="relative">
              <div className={`grid grid-cols-3 gap-2 p-4 bg-[#111827] rounded-xl border border-white/10 ${!showPhrase ? 'blur-md select-none' : ''}`}>
                {mnemonic.split(' ').map((word, i) => (
                  <div key={i} className="flex items-center gap-1.5 py-1">
                    <span className="text-[10px] text-gray-500 w-4">{i + 1}.</span>
                    <span className="text-xs font-mono">{word}</span>
                  </div>
                ))}
              </div>
              {!showPhrase && (
                <button onClick={() => setShowPhrase(true)} className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#111827] rounded-lg border border-white/10">
                    <Eye className="w-4 h-4" /> <span className="text-xs font-semibold">Tap to Reveal</span>
                  </div>
                </button>
              )}
            </div>

            <button onClick={() => navigator.clipboard.writeText(mnemonic)} className="w-full py-2 border border-white/10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 hover:bg-white/5">
              <Copy className="w-3 h-3" /> Copy Phrase
            </button>

            <div className="p-3 bg-[#111827] rounded-xl border border-white/5">
              <p className="text-[10px] text-gray-400 mb-1"><strong>Address:</strong></p>
              <p className="text-xs font-mono text-[#00E5FF] break-all">{address}</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="rounded" />
              <span className="text-xs text-gray-400">I have saved my recovery phrase securely</span>
            </label>

            <button onClick={confirmAndSave} disabled={!confirmed} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
              <Check className="w-4 h-4 inline mr-1" /> Continue to Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportWalletView({ onBack, onImported }: { onBack: () => void; onImported: (w: StoredWallet) => void }) {
  const [method, setMethod] = useState<'phrase' | 'key'>('phrase');
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [walletName, setWalletName] = useState('Imported Wallet');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!input.trim() || !password || password.length < 6) return;
    setImporting(true);
    setError('');
    try {
      const ethers = await import('ethers');
      let wallet: any;
      if (method === 'phrase') {
        wallet = ethers.Wallet.fromPhrase(input.trim());
      } else {
        wallet = new ethers.Wallet(input.trim());
      }
      const encrypted = simpleEncrypt(wallet.privateKey, password);
      onImported({
        address: wallet.address,
        encryptedKey: encrypted,
        name: walletName,
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e.message || 'Invalid input. Check your recovery phrase or private key.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-1">Import Wallet</h1>
        <p className="text-gray-400 text-xs mb-6">Import using recovery phrase or private key</p>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setMethod('phrase')} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${method === 'phrase' ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
            Recovery Phrase
          </button>
          <button onClick={() => setMethod('key')} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${method === 'key' ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
            Private Key
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Wallet Name</label>
            <input value={walletName} onChange={e => setWalletName(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{method === 'phrase' ? 'Recovery Phrase (12 or 24 words)' : 'Private Key'}</label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={method === 'phrase' ? 4 : 2}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00E5FF]/50 resize-none"
              placeholder={method === 'phrase' ? 'word1 word2 word3 ...' : '0x...'}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Set Password (min 6 chars)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="Encrypt your keys" />
          </div>

          {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 p-2 rounded-lg">{error}</p>}

          <button onClick={handleImport} disabled={importing || !input.trim() || password.length < 6} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
            {importing ? 'Importing...' : 'Import Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SendView({ onBack, wallet }: { onBack: () => void; wallet: StoredWallet }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'input' | 'sending' | 'success' | 'error'>('input');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!to || !amount || !password) return;
    setStatus('sending');
    setError('');
    try {
      const ethers = await import('ethers');
      const decryptedKey = simpleDecrypt(wallet.encryptedKey, password);
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_ALCHEMY_RPC || 'https://eth.llamarpc.com'
      );
      const signer = new ethers.Wallet(decryptedKey, provider);
      const tx = await signer.sendTransaction({
        to,
        value: ethers.parseEther(amount),
      });
      setTxHash(tx.hash);
      setStatus('success');
    } catch (e: any) {
      setError(e.message || 'Transaction failed');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-6">Send ETH</h1>

        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#10B981]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[#10B981]" />
            </div>
            <h2 className="text-lg font-bold mb-2">Transaction Sent!</h2>
            <p className="text-gray-400 text-sm mb-4">{amount} ETH sent successfully</p>
            <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-[#00E5FF] text-xs underline">View on Etherscan</a>
            <button onClick={onBack} className="w-full mt-4 py-2.5 border border-white/10 rounded-lg text-sm font-semibold">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Recipient Address</label>
              <input value={to} onChange={e => setTo(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00E5FF]/50" placeholder="0x..." />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Amount (ETH)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.001" className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00E5FF]/50" placeholder="0.01" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Wallet Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="Enter your wallet password" />
            </div>
            {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 p-2 rounded-lg">{error}</p>}
            <button onClick={handleSend} disabled={status === 'sending' || !to || !amount || !password} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
              {status === 'sending' ? 'Sending...' : 'Send Transaction'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiveView({ onBack, address }: { onBack: () => void; address: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-6">Receive ETH</h1>

        <div className="text-center">
          <div className="w-48 h-48 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center p-4">
            <div className="w-full h-full bg-[#111827] rounded-lg flex items-center justify-center">
              <Wallet className="w-16 h-16 text-[#00E5FF]" />
            </div>
          </div>
          <p className="text-gray-400 text-xs mb-3">Send ETH or ERC-20 tokens to this address:</p>
          <div className="bg-[#111827] border border-white/10 rounded-xl p-3 mb-4">
            <p className="text-xs font-mono break-all text-[#00E5FF]">{address}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="w-full py-2.5 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          >
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Address</>}
          </button>
          <p className="text-[10px] text-gray-500 mt-3">Only send Ethereum network tokens to this address. Sending tokens from other networks may result in loss.</p>
        </div>
      </div>
    </div>
  );
}

function AddTokenView({ onBack, tokens, onAdd }: { onBack: () => void; tokens: string[]; onAdd: (addr: string) => void }) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Invalid ERC-20 contract address');
      return;
    }
    if (tokens.includes(address.toLowerCase())) {
      setError('Token already added');
      return;
    }
    onAdd(address.toLowerCase());
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 text-xs mb-6 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-heading font-bold mb-1">Add Custom Token</h1>
        <p className="text-gray-400 text-xs mb-6">Import any ERC-20 token by contract address</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Token Contract Address</label>
            <input value={address} onChange={e => { setAddress(e.target.value); setError(''); }} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#00E5FF]/50" placeholder="0x..." />
          </div>
          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
          <button onClick={handleAdd} disabled={!address} className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50">
            Add Token
          </button>

          {tokens.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-2">Custom Tokens ({tokens.length})</h3>
              <div className="space-y-1">
                {tokens.map(t => (
                  <div key={t} className="flex items-center justify-between bg-[#111827] rounded-lg px-3 py-2 text-[10px] font-mono text-gray-400">
                    <span>{t.slice(0, 10)}...{t.slice(-8)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
