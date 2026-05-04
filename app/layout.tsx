import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./globals-brand.css";
import "@/styles/rtl.css";
import AuthProvider from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { WalletProvider } from "@/context/WalletContext";
import { WalletProviders as AppKitWalletProviders } from "./wallet-providers";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import AutoTranslate from "@/components/i18n/AutoTranslate";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: {
    default: "Naka Labs — On-Chain Intelligence Platform",
    template: "%s | Naka Labs",
  },
  description: "On-chain intelligence for every trade. Real-time crypto analytics, whale tracking, wallet clusters, and AI-powered trading across Ethereum, Solana, Base, and more.",
  keywords: ["crypto intelligence", "on-chain analytics", "whale tracker", "token scanner", "rug pull detector", "DeFi tools", "blockchain analytics"],
  authors: [{ name: "Naka Labs" }],
  creator: "Naka Labs",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://steinzlabs.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://steinzlabs.vercel.app",
    siteName: "Naka Labs",
    title: "Naka Labs — On-Chain Intelligence Platform",
    description: "On-chain intelligence for every trade.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Naka Labs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Naka Labs — On-Chain Intelligence",
    description: "On-chain intelligence for every trade.",
    creator: "@nakalabs",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "icon", url: "/icons/icon-32.png", sizes: "32x32" },
      { rel: "icon", url: "/icons/icon-192.png", sizes: "192x192" },
    ],
  },
  manifest: "/manifest.json",
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
      <head>
        {/* Pre-hydration flash guard for auto-translate: if the user
            has a non-English language stored, hide the body with a CSS
            class before React mounts. AutoTranslate.tsx removes the
            class once the first translate pass completes (1.5s safety
            timeout fallback). Same pattern used for theme persistence. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('naka_language');if(l&&l!=='en'){document.documentElement.classList.add('naka-translating');if(l==='ar'){document.documentElement.setAttribute('dir','rtl');}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AutoTranslate />
          <AuthProvider>
            <WalletProvider>
              {/* AppKit (Reown / WalletConnect v2) lives INSIDE the legacy
                  custom WalletProvider so existing useWallet() consumers
                  keep working. New surfaces (swap page) trigger the AppKit
                  modal directly via useAppKit(); a thin bridge in
                  components/wallet/AppKitBridge.tsx mirrors AppKit's
                  connected account back into the legacy localStorage
                  contract so legacy code reads it transparently. */}
              <AppKitWalletProviders>
                <ToastProvider>
                  <Suspense fallback={null}>
                    <PostHogProvider>
                      {children}
                    </PostHogProvider>
                  </Suspense>
                </ToastProvider>
              </AppKitWalletProviders>
            </WalletProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
