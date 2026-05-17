'use client';
import { DetailErrorBoundary } from '@/components/errors/DetailErrorBoundary';
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <DetailErrorBoundary {...props} backHref="/dashboard/wallet-clusters" backLabel="Wallet clusters" />;
}
