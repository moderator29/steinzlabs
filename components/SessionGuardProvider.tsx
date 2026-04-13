'use client';

import { useSessionGuard } from '@/lib/hooks/useSessionGuard';

/**
 * Mounts session guard logic for authenticated pages.
 * - Enforces 30-min idle timeout
 * - Detects missing session cookie and redirects to /login?session=expired
 */
export default function SessionGuardProvider() {
  useSessionGuard();
  return null;
}
