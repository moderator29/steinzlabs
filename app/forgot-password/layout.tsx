import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot Password | Naka Labs',
  description: 'Reset your Naka Labs account password by requesting a secure recovery link.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
