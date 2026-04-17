interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    selectedAddress: string | null;
    chainId: string;
  };
  solana?: {
    isPhantom?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: unknown) => Promise<unknown>;
    signAllTransactions: (transactions: unknown[]) => Promise<unknown[]>;
    signAndSendTransaction: (transaction: unknown) => Promise<{ signature: string }>;
    publicKey: { toString: () => string } | null;
  };
}
