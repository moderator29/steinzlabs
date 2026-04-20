import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/rtl.css";
import AuthProvider from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { WalletProvider } from "@/context/WalletContext";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
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
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
