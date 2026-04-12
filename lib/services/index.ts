/**
 * Steinz Labs — Unified Service Layer
 *
 * All external API calls route through this layer.
 * Components and pages NEVER call external APIs directly.
 */

export * from './anthropic';
export * from './goplus';
export * from './coingecko';
export * from './dexscreener';
export * from './alchemy';
export * from './helius';
export * from './lunarcrush';
export * from './arkham';
export * from './jupiter';
export * from './swap';
export * from './resend';
export * from './supabase';
export * from './birdeye';
export * from './defillama';
export * from './webpush';

// ─── Shared Error Types ────────────────────────────────────────────────────────

export interface ServiceError {
  ok: false;
  error: string;
  code?: string;
}

export interface ServiceOk<T> {
  ok: true;
  data: T;
}

export type ServiceResult<T> = ServiceOk<T> | ServiceError;

export function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

export function err(error: string, code?: string): ServiceError {
  return { ok: false, error, code };
}
