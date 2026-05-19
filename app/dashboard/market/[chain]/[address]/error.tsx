'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { RouteErrorState } from '@/components/errors/RouteErrorState';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { route: 'app/dashboard/market/[chain]/[address]' } });
  }, [error]);
  return <RouteErrorState error={error} reset={reset} context="token" />;
}
