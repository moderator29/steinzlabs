'use client';

import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { Component, ReactNode } from 'react';

class PrivyErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: false };
  }

  componentDidCatch(error: Error) {
    if (
      error?.message?.includes('onMount') ||
      error?.message?.includes('solana') ||
      error?.message?.includes('externalWallets')
    ) {
      return;
    }
    console.warn('[PrivyErrorBoundary] Caught error:', error?.message);
  }

  render() {
    return this.props.children;
  }
}

export default function PrivyProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyErrorBoundary>
      <PrivyProviderBase
        appId={appId}
        config={{
          appearance: {
            theme: 'dark',
            accentColor: '#0A1EFF',
            logo: '/steinz-logo-128.png',
          },
          loginMethods: ['email', 'google', 'twitter', 'wallet'],
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
            requireUserPasswordOnCreate: false,
          },
          defaultChain: {
            id: 1,
            name: 'Ethereum',
            network: 'homestead',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://eth.llamarpc.com'] },
              public: { http: ['https://eth.llamarpc.com'] },
            },
          },
          supportedChains: [
            {
              id: 1,
              name: 'Ethereum',
              network: 'homestead',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: {
                default: { http: ['https://eth.llamarpc.com'] },
                public: { http: ['https://eth.llamarpc.com'] },
              },
            },
            {
              id: 8453,
              name: 'Base',
              network: 'base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: {
                default: { http: ['https://mainnet.base.org'] },
                public: { http: ['https://mainnet.base.org'] },
              },
            },
            {
              id: 56,
              name: 'BNB Smart Chain',
              network: 'bsc',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: {
                default: { http: ['https://bsc-dataseed.binance.org'] },
                public: { http: ['https://bsc-dataseed.binance.org'] },
              },
            },
          ],
        }}
      >
        {children}
      </PrivyProviderBase>
    </PrivyErrorBoundary>
  );
}
