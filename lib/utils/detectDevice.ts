/**
 * Centralised device + wallet-extension detection. Replaces the three
 * inlined regex/userAgent checks scattered across `lib/hooks/useWallet.ts`.
 *
 * Pure functions, safe to import in client components. SSR-safe — every
 * helper guards on `typeof window`.
 */

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function isMobile(): boolean {
  if (!isBrowser()) return false;
  return MOBILE_UA.test(navigator.userAgent);
}

export function isIOS(): boolean {
  if (!isBrowser()) return false;
  // iPadOS 13+ reports as Macintosh — distinguish via touch points.
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isAndroid(): boolean {
  if (!isBrowser()) return false;
  return /Android/i.test(navigator.userAgent);
}

/** True when MetaMask's injected provider is present in this tab. */
export function hasMetaMaskExtension(): boolean {
  if (!isBrowser()) return false;
  const eth = (window as unknown as { ethereum?: { isMetaMask?: boolean } }).ethereum;
  return !!eth?.isMetaMask;
}

/** True when ANY EIP-1193 injected provider is present. */
export function hasEthereumProvider(): boolean {
  if (!isBrowser()) return false;
  return typeof (window as unknown as { ethereum?: unknown }).ethereum !== 'undefined';
}

/** True when Phantom's injected provider is present in this tab. */
export function hasPhantomExtension(): boolean {
  if (!isBrowser()) return false;
  const sol = (window as unknown as { solana?: { isPhantom?: boolean } }).solana;
  return !!sol?.isPhantom;
}

/** True when ANY Solana injected provider is present. */
export function hasSolanaProvider(): boolean {
  if (!isBrowser()) return false;
  return typeof (window as unknown as { solana?: unknown }).solana !== 'undefined';
}

export interface DeviceProfile {
  isBrowser: boolean;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  hasMetaMaskExtension: boolean;
  hasEthereumProvider: boolean;
  hasPhantomExtension: boolean;
  hasSolanaProvider: boolean;
}

export function getDeviceProfile(): DeviceProfile {
  return {
    isBrowser: isBrowser(),
    isMobile: isMobile(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    hasMetaMaskExtension: hasMetaMaskExtension(),
    hasEthereumProvider: hasEthereumProvider(),
    hasPhantomExtension: hasPhantomExtension(),
    hasSolanaProvider: hasSolanaProvider(),
  };
}
