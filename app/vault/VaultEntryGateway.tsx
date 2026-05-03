'use client';
import { VaultEntryAnimation } from '@/components/vault/VaultEntryAnimation';

/**
 * Tiny wrapper around VaultEntryAnimation that exists only so the
 * server-rendered /vault page can stay async + cached. Keeps the
 * client-only entry component out of the page module's top-level
 * component graph.
 */
export function VaultEntryGateway() {
  return <VaultEntryAnimation />;
}
