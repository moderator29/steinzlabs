'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 1 hour idle timeout
const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const ACTIVITY_KEY = 'steinz_last_activity';

/**
 * Enforces session expiry rules:
 * 1. Supabase session is the source of truth. If it is gone, redirect to /login.
 * 2. If the user has been idle for > 60 minutes → sign out and redirect.
 *
 * NOTE (2026-04-17): previously this hook also required a legacy
 * `steinz_session` cookie. That cookie is no longer issued by the email/password
 * flow (only by `/auth/callback` for OAuth). Demanding it caused a 10-second
 * redirect loop where authenticated users were kicked back to /login. The
 * cookie check has been removed — @supabase/ssr cookies are authoritative.
 *
 * Must be used inside a component that is mounted only for authenticated users
 * (e.g. dashboard layout).
 */
export function useSessionGuard() {
  const router = useRouter();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activityBound = useRef(false);

  const signOutAndRedirect = useCallback(async () => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(ACTIVITY_KEY);
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (err) {
      console.error('[useSessionGuard] Sign out failed:', err);
    }
    router.replace('/login?session=expired');
  }, [router]);

  const updateActivity = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    }
  }, []);

  const checkSession = useCallback(async () => {
    if (!supabase) return;

    // Supabase session is the source of truth.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace('/login');
      return;
    }

    // Idle timeout check — only if we have recorded activity.
    if (typeof localStorage !== 'undefined') {
      const last = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10);
      const idleMs = Date.now() - last;
      if (last > 0 && idleMs > IDLE_TIMEOUT_MS) {
        await signOutAndRedirect();
      }
    }
  }, [signOutAndRedirect, router]);

  useEffect(() => {
    updateActivity();

    if (!activityBound.current) {
      activityBound.current = true;
      const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
      const handler = () => updateActivity();
      events.forEach(ev => window.addEventListener(ev, handler, { passive: true }));

      const onFocus = () => { void checkSession(); };
      window.addEventListener('focus', onFocus);

      return () => {
        events.forEach(ev => window.removeEventListener(ev, handler));
        window.removeEventListener('focus', onFocus);
      };
    }
  }, [updateActivity, checkSession]);

  useEffect(() => {
    // Defer the initial check so @supabase/ssr has time to write cookies
    // after a fresh sign-in redirect (hard navigation race window ~500ms).
    const initialTimer = setTimeout(() => { void checkSession(); }, 2000);

    checkIntervalRef.current = setInterval(() => { void checkSession(); }, 2 * 60 * 1000);
    return () => {
      clearTimeout(initialTimer);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkSession]);
}
