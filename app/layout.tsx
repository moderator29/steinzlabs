import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STEINZ LABS - On-Chain Intelligence Redefined",
  description: "The only platform that shows you what Smart Money sees before everyone else.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
