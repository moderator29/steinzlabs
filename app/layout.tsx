import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/rtl.css";
import AuthProvider from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { WalletProvider } from "@/context/WalletContext";
import { PostHogProvider } from "@/components/PostHogProvider";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: {
    default: "Steinz Labs — On-Chain Intelligence Platform",
    template: "%s | Steinz Labs",
  },
  description: "Professional on-chain intelligence platform. Track whales, analyze wallets, scan tokens for rug risks, and act on real-time blockchain data across Ethereum, Solana, Base, and more.",
  keywords: ["crypto intelligence", "on-chain analytics", "whale tracker", "token scanner", "rug pull detector", "DeFi tools", "blockchain analytics"],
  authors: [{ name: "Steinz Labs" }],
  creator: "Steinz Labs",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://steinzlabs.com",
    siteName: "Steinz Labs",
    title: "Steinz Labs — On-Chain Intelligence Platform",
    description: "Track whales, scan tokens, and trade smarter with real-time blockchain intelligence.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Steinz Labs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Steinz Labs — On-Chain Intelligence",
    description: "Track whales, scan tokens, and trade smarter.",
    creator: "@steinzlabs",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider>
          <WalletProvider>
            <ToastProvider>
              <Suspense fallback={null}>
                <PostHogProvider>
                  {children}
                </PostHogProvider>
              </Suspense>
            </ToastProvider>
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
