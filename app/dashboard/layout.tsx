import { ReactNode } from 'react';
import type { Metadata } from 'next';
import FloatingBackButton from '@/components/FloatingBackButton';

export const metadata: Metadata = {
  title: 'STEINZ Dashboard - On-Chain Intelligence',
  description: 'Real-time AI-powered crypto intelligence dashboard',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      {children}
      <FloatingBackButton />
    </div>
  );
}
