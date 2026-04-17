let _walletSessionKey: string | null = null;

export function setWalletSessionKey(key: string) {
  _walletSessionKey = key;
}

export function getWalletSessionKey(): string | null {
  return _walletSessionKey;
}

export function clearWalletSessionKey() {
  _walletSessionKey = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', clearWalletSessionKey);
}
