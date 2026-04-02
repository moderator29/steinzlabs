import type { Metadata, Viewport } from "next";
import "./globals.css";
import PrivyProvider from "@/components/providers/PrivyProvider";

export const metadata: Metadata = {
  title: "Naka Labs - On-Chain Intelligence Powered by $NAKA",
  description: "Professional on-chain intelligence platform. Track whales, analyze wallets, scan tokens, and act on blockchain data — powered by $NAKA.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <PrivyProvider>{children}</PrivyProvider>
      </body>
    </html>
  );
}
