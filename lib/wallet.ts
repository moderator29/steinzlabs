export interface WalletConnection {
  address: string;
  chainId?: string;
  provider: 'metamask' | 'phantom';
}

export async function connectMetaMask(): Promise<WalletConnection> {
  if (typeof (window as any).ethereum === 'undefined') {
    throw new Error('MetaMask not installed. Please install MetaMask to connect.');
  }

  const accounts = await (window as any).ethereum.request({
    method: 'eth_requestAccounts'
  });

  const address = accounts[0];

  const chainId = await (window as any).ethereum.request({
    method: 'eth_chainId'
  });

  return {
    address,
    chainId,
    provider: 'metamask'
  };
}

export async function connectPhantom(): Promise<WalletConnection> {
  if (typeof (window as any).solana === 'undefined') {
    throw new Error('Phantom not installed. Please install Phantom wallet to connect.');
  }

  const response = await (window as any).solana.connect();
  const address = response.publicKey.toString();

  return {
    address,
    provider: 'phantom'
  };
}

export async function connectWallet(): Promise<WalletConnection> {
  if (typeof (window as any).ethereum !== 'undefined') {
    return connectMetaMask();
  }

  if (typeof (window as any).solana !== 'undefined') {
    return connectPhantom();
  }

  throw new Error('Please install MetaMask or Phantom wallet to connect.');
}

export function getStoredWallet(): { address: string; provider: string } | null {
  const address = localStorage.getItem('wallet_address');
  const provider = localStorage.getItem('wallet_provider');
  if (address) {
    return { address, provider: provider || 'metamask' };
  }
  return null;
}

export function clearStoredWallet() {
  localStorage.removeItem('wallet_address');
  localStorage.removeItem('wallet_provider');
  localStorage.removeItem('wallet_signature');
}
