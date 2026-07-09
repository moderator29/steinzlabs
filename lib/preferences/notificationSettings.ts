'use client';

/**
 * Notification settings — Supabase-backed CRUD over the
 * `public.notification_settings` row for the current user.
 *
 * Phase B (profile features) — replaces the localStorage-only prefs
 * the original ProfileTab shipped with. Cross-device sync, server
 * authority, and a single canonical shape that the cron + edge
 * delivery functions can read from.
 *
 * Row shape (existing columns):
 *   user_id              uuid (FK auth.users)
 *   push_enabled         boolean
 *   whale_alerts         boolean
 *   smart_money          boolean
 *   price_alerts         boolean
 *   security_alerts      boolean
 *   weekly_digest        boolean
 *   updated_at           timestamptz
 *
 * Pending columns (apply migration
 * supabase/migrations/2026_05_15_notification_quiet_hours.sql):
 *   email_enabled
 *   telegram_enabled
 *   quiet_hours_enabled / quiet_hours_start_minute /
 *   quiet_hours_end_minute / quiet_hours_timezone
 *
 * The hook detects absence of the new columns at runtime and renders
 * those toggles in a 'coming soon' state so it ships safely before
 * the migration is applied.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface NotificationSettings {
  user_id: string;
  // Channels
  push_enabled: boolean;
  email_enabled?: boolean;
  telegram_enabled?: boolean;
  // Events
  whale_alerts: boolean;
  smart_money: boolean;
  price_alerts: boolean;
  security_alerts: boolean;
  weekly_digest: boolean;
  /** Twice-daily crypto news roundup (email/telegram). Off by default. */
  news_alerts?: boolean;
  // Do Not Disturb
  quiet_hours_enabled?: boolean;
  quiet_hours_start_minute?: number;
  quiet_hours_end_minute?: number;
  quiet_hours_timezone?: string;
  updated_at?: string;
}

const DEFAULTS: Omit<NotificationSettings, 'user_id'> = {
  push_enabled: false,
  email_enabled: true,
  telegram_enabled: false,
  whale_alerts: true,
  smart_money: true,
  price_alerts: true,
  security_alerts: true,
  weekly_digest: false,
  news_alerts: false,
  quiet_hours_enabled: false,
  quiet_hours_start_minute: 22 * 60, // 22:00
  quiet_hours_end_minute: 7 * 60,    // 07:00
  quiet_hours_timezone: typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC',
};

interface HookResult {
  settings: NotificationSettings | null;
  loading: boolean;
  /** True when the migration adding email/telegram/quiet-hours columns is live in the DB. UI hides those rows when false. */
  hasExtendedSchema: boolean;
  update: (patch: Partial<NotificationSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

export function useNotificationSettings(userId: string | null | undefined): HookResult {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasExtendedSchema, setHasExtendedSchema] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !supabase) {
      // Profile-spinner crash fix — without seeding `settings` here, the
      // consumer (NotificationSettingsPanel) renders Loading… forever
      // because its guard is `if (loading || !settings)`. Seed defaults
      // so even an unauthenticated/no-supabase environment shows the UI.
      setSettings({ ...DEFAULTS, user_id: userId ?? '' });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Probe the extended columns. A clean (error-free) select is the
      // authoritative signal that the migration is live — if any extended
      // column is missing, PostgREST fails the whole select, so success
      // means every listed column exists. We previously keyed only off the
      // exact 42703 code, which mis-reported the schema as "pending" on any
      // other transient error even though the columns exist in prod; basing
      // it on success removes that fragility.
      let extendedAvailable = false;
      let row: NotificationSettings | null = null;
      const tryExtended = await supabase
        .from('notification_settings')
        .select('user_id, push_enabled, email_enabled, telegram_enabled, whale_alerts, smart_money, price_alerts, security_alerts, weekly_digest, news_alerts, quiet_hours_enabled, quiet_hours_start_minute, quiet_hours_end_minute, quiet_hours_timezone, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (!tryExtended.error) {
        extendedAvailable = true;
        row = (tryExtended.data as NotificationSettings | null) ?? null;
      } else {
        // Any error (missing columns pre-migration, or a transient failure):
        // fall back to the always-present legacy columns so the panel loads.
        // The extended toggles render in a 'coming soon' state until a later
        // reload confirms the schema.
        const fallback = await supabase
          .from('notification_settings')
          .select('user_id, push_enabled, whale_alerts, smart_money, price_alerts, security_alerts, weekly_digest, updated_at')
          .eq('user_id', userId)
          .maybeSingle();
        row = (fallback.data as NotificationSettings | null) ?? null;
      }
      setHasExtendedSchema(extendedAvailable);
      if (!row) {
        // No row yet — render local defaults; first toggle will upsert.
        setSettings({ ...DEFAULTS, user_id: userId });
      } else {
        setSettings({ ...DEFAULTS, ...row });
      }
    } catch (err) {
      console.error('[notifSettings] load failed:', err);
      setSettings({ ...DEFAULTS, user_id: userId });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const update = useCallback(async (patch: Partial<NotificationSettings>) => {
    if (!userId || !supabase || !settings) return;
    const next = { ...settings, ...patch, user_id: userId };
    // Optimistic update so the toggle clicks feel instant; rollback on
    // server failure.
    setSettings(next);
    try {
      // Strip extended columns from the upsert payload when the
      // schema isn't ready, so we don't 42703 on every save.
      const payload: Partial<NotificationSettings> & { user_id: string } = hasExtendedSchema
        ? next
        : {
            user_id: userId,
            push_enabled: next.push_enabled,
            whale_alerts: next.whale_alerts,
            smart_money: next.smart_money,
            price_alerts: next.price_alerts,
            security_alerts: next.security_alerts,
            weekly_digest: next.weekly_digest,
          };
      const { error } = await supabase.from('notification_settings').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (err) {
      console.error('[notifSettings] save failed, rolling back:', err);
      setSettings(settings);
      throw err;
    }
  }, [userId, settings, hasExtendedSchema]);

  return { settings, loading, hasExtendedSchema, update, reload: load };
}
