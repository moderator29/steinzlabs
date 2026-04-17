import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot Password | Steinz Labs',
  description: 'Reset your Steinz Labs account password by requesting a secure recovery link.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
