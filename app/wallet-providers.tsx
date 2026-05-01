'use client';

/**
 * Top-level wallet provider tree for AppKit (Reown / WalletConnect v2).
 * Mounted in app/layout.tsx INSIDE the existing custom WalletProvider
 * so legacy useWallet() consumers keep working unchanged.
 *
 * If NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing, this component
 * renders children without any wagmi / AppKit context. Call sites
 * MUST guard their `useAppKit()` / `useAppKitAccount()` calls with the
 * `HAS_APPKIT` flag from `lib/wallet/appkit` — otherwise those hooks
 * throw or return undefined.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { WagmiProvider, type Config } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiAdapter, getAppKit, HAS_APPKIT } from '@/lib/wallet/appkit';
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
  // the WalletConnect transport. No-op if PROJECT_ID is missing.
  useEffect(() => {
    getAppKit();
  }, []);

  // wagmiAdapter.wagmiConfig is the Wagmi v2 Config built by AppKit's
  // adapter. Cast at the boundary; the adapter's type is loose.
  const config = useMemo(
    () => (wagmiAdapter ? (wagmiAdapter.wagmiConfig as unknown as Config) : null),
    [],
  );

  // Without a project ID we still render children so the rest of the
  // app keeps working. The "WalletConnect" pill on the swap page
  // checks HAS_APPKIT and stays hidden in that case.
  if (!HAS_APPKIT || !config) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AppKitBridge />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
