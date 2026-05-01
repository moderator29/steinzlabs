'use client';

/**
 * Top-level wallet provider tree for AppKit (Reown / WalletConnect v2).
 * Mounted in app/layout.tsx INSIDE the existing custom WalletProvider
 * so legacy useWallet() consumers keep working unchanged.
 *
 * Side-effect import: `getAppKit()` runs `createAppKit()` once on the
 * client. AppKit is a singleton so subsequent imports are no-ops.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { WagmiProvider, type Config } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiAdapter, getAppKit } from '@/lib/wallet/appkit';
import AppKitBridge from '@/components/wallet/AppKitBridge';

export function WalletProviders({ children }: { children: ReactNode }) {
  // QueryClient must live for the lifetime of the tree. useState
  // ensures we don't reinit on every render (would clear cache).
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  // Initialise AppKit on the client only — it touches `window` for
  // the WalletConnect transport. Returns null if PROJECT_ID is missing,
  // in which case the wagmi tree still mounts (legacy connect paths
  // remain functional) and the AppKit modal trigger falls back to the
  // legacy picker.
  useEffect(() => {
    getAppKit();
  }, []);

  // wagmiAdapter.wagmiConfig is the Wagmi v2 Config built by AppKit's
  // adapter. Cast at the boundary; the adapter's type is loose.
  const config = useMemo(() => wagmiAdapter.wagmiConfig as unknown as Config, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AppKitBridge />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
