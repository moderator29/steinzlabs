import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password | Naka Labs',
  description: 'Set a new password for your Naka Labs account.',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
