import type { Metadata, Viewport } from "next";
import "./globals.css";
import PrivyProvider from "@/components/providers/PrivyProvider";

export const metadata: Metadata = {
  title: "STEINZ LABS - On-Chain Intelligence Redefined",
  description: "The only platform that shows you what Smart Money sees before everyone else.",
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
