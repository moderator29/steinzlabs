import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your free Steinz Labs account to access on-chain intelligence tools.',
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
