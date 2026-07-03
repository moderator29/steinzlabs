import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
import CookieConsent from "@/components/legal/CookieConsent";
import NavDepthTracker from "@/components/common/NavDepthTracker";
import { Suspense } from "react";
import { JurisdictionWarning } from "@/components/legal/JurisdictionWarning";
import { WebVitalsReporter } from "@/components/providers/WebVitalsReporter";

// PDF S2 / B.11 — self-host Inter + JetBrains Mono via next/font so the
// Google Fonts request doesn't block first paint. The CSS now references
// var(--font-inter) / var(--font-jetbrains-mono) instead of the imported
// stylesheet URL, eliminating an FCP-blocking external request.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Naka Labs — On-Chain Intelligence Platform",
    template: "%s | Naka Labs",
  },
  description: "On-chain intelligence for every trade. Real-time crypto analytics, whale tracking, wallet clusters, and AI-powered trading across Ethereum, Solana, Base, and more.",
  keywords: ["crypto intelligence", "on-chain analytics", "whale tracker", "token scanner", "rug pull detector", "DeFi tools", "blockchain analytics"],
  authors: [{ name: "Naka Labs" }],
  creator: "Naka Labs",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nakalabs.xyz"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://nakalabs.xyz",
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
  // A11Y8: viewport-fit=cover lets the app paint into the iOS notch /
  // home-indicator safe areas. Components that need to inset from the
  // hardware should use the env(safe-area-inset-*) values.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
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
        {/* §3.4 — appearance pre-hydration guard: apply the stored theme /
            accent / glass / density / text / motion to <html> before first
            paint so there's no flash. Mirrors lib/theme/appearance.ts
            applyAppearance(); AppearanceProvider reconciles with the server
            row after mount. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var A={blue:['#0066FF','#0052CC','rgba(0,102,255,0.15)'],violet:['#7C3AED','#6D28D9','rgba(124,58,237,0.15)'],teal:['#06B6D4','#0891B2','rgba(6,182,212,0.15)'],crimson:['#DC143C','#B01030','rgba(220,20,60,0.15)'],gold:['#F59E0B','#D97706','rgba(245,158,11,0.15)']};var p={};try{p=JSON.parse(localStorage.getItem('naka_appearance')||'{}')||{}}catch(e){}var eff='dark';var ac=A[p.accent]?p.accent:'blue';d.setAttribute('data-theme',eff);d.setAttribute('data-accent',ac);d.setAttribute('data-glass',['off','subtle','full'].indexOf(p.glass)>=0?p.glass:'full');d.setAttribute('data-density',p.density==='compact'?'compact':'comfortable');d.setAttribute('data-text',['small','default','large'].indexOf(p.textSize)>=0?p.textSize:'default');var rm=p.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;d.setAttribute('data-motion',rm?'reduced':'full');d.style.colorScheme=eff;var a=A[ac];d.style.setProperty('--nl-accent',a[0]);d.style.setProperty('--nl-blue',a[0]);d.style.setProperty('--nl-blue-strong',a[1]);d.style.setProperty('--nl-accent-soft',a[2]);}catch(e){}})();`,
          }}
        />
        {/* §nakacult-scroll-bug — disable browser scroll restoration so the
            naka-cult landing page doesn't yank back to a previous scroll
            position after layout shifts (chamber portals + animated
            stats strip re-mounting). Next's per-route scroll-to-top
            still works because next/link's default `scroll={true}` calls
            window.scrollTo(0,0). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if('scrollRestoration' in window.history){window.history.scrollRestoration='manual';}})();`,
          }}
        />
        {/* Organization schema.org JSON-LD. Google + Bing use this for
            the knowledge-panel sidelines + sitelinks search box; missing
            it costs us "Naka Labs" rich results. Site URL pulls from
            env so the canonical URL flips correctly across preview
            deploys. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Naka Labs',
              url: process.env.NEXT_PUBLIC_SITE_URL || 'https://nakalabs.xyz',
              logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nakalabs.xyz'}/icons/icon-192.png`,
              sameAs: [
                'https://x.com/nakalabs',
                'https://t.me/nakalabs',
              ],
              description:
                'On-chain intelligence for every trade. Real-time crypto analytics, whale tracking, wallet clusters, and AI-powered trading.',
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Naka Labs',
              url: process.env.NEXT_PUBLIC_SITE_URL || 'https://nakalabs.xyz',
              potentialAction: {
                '@type': 'SearchAction',
                target: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nakalabs.xyz'}/dashboard/market?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* WCAG 2.4.1 / a11y P0 — screen-reader-only skip link that
            becomes visible on :focus so keyboard users can bypass the
            sidebar + header and jump straight to main content. */}
        <a href="#main" className="naka-skip-link">
          Skip to main content
        </a>
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
                      {/* Compliance MVB — see components/legal/CookieConsent.tsx.
                          Renders only on first visit until the user picks a
                          choice. Pure client; no server cost. */}
                      <CookieConsent />
                      <JurisdictionWarning />
                      <WebVitalsReporter />
                      {/* In-app nav depth counter backing smartBack() — see
                          lib/navigation/smartBack.ts. usePathname needs the
                          Suspense boundary above. */}
                      <NavDepthTracker />
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
