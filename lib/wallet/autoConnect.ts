'use client';

const WALLET_STORAGE_KEY = 'steinz_connected_wallet';
const WALLET_CHAIN_KEY = 'steinz_wallet_chain';

export interface StoredWallet {
  address: string;
  chain: string;
  connectedAt: number;
  label?: string;
}

export function saveWalletConnection(wallet: StoredWallet): void {
  try {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
    localStorage.setItem(WALLET_CHAIN_KEY, wallet.chain);
  } catch {}
}

export function getStoredWallet(): StoredWallet | null {
  try {
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) return null;
    const wallet: StoredWallet = JSON.parse(raw);
    const maxAge = 48 * 60 * 60 * 1000;
    if (Date.now() - wallet.connectedAt > maxAge) {
      clearWalletConnection();
      return null;
    }
    return wallet;
  } catch {
    return null;
  }
}

export function clearWalletConnection(): void {
  try {
    localStorage.removeItem(WALLET_STORAGE_KEY);
    localStorage.removeItem(WALLET_CHAIN_KEY);
  } catch {}
}

export function getPreferredChain(): string {
  try {
    return localStorage.getItem(WALLET_CHAIN_KEY) || 'ethereum';
  } catch {
    return 'ethereum';
  }
}

export async function attemptAutoConnect(): Promise<StoredWallet | null> {
  const stored = getStoredWallet();
  if (!stored) return null;

  if (stored.chain === 'ethereum' || stored.chain === 'polygon' || stored.chain === 'arbitrum' || stored.chain === 'base') {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          const currentAddress = accounts[0].toLowerCase();
          if (currentAddress === stored.address.toLowerCase()) {
            return stored;
          }
        }
      } catch {}
    }
  }

  if (stored.chain === 'solana') {
    if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
      try {
        const resp = await (window as any).solana.connect({ onlyIfTrusted: true });
        if (resp.publicKey.toString() === stored.address) {
          return stored;
        }
      } catch {}
    }
  }

  return null;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
