'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 30 minutes idle timeout
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = 'steinz_last_activity';
const SESSION_COOKIE = 'steinz_session';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Enforces session expiry rules:
 * 1. If the session cookie is gone while Supabase thinks user is still logged in → sign out
 * 2. If the user has been idle for > 30 minutes → sign out
 *
 * Must be used inside a component that is mounted only for authenticated users
 * (e.g. dashboard layout).
 */
export function useSessionGuard() {
  const router = useRouter();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activityBound = useRef(false);

  const signOutAndRedirect = useCallback(async () => {
    clearSessionCookie();
    if (typeof localStorage !== 'undefined') localStorage.removeItem(ACTIVITY_KEY);
    try {
      if (supabase) await supabase.auth.signOut();
    } catch {}
    router.replace('/login?session=expired');
  }, [router]);

  const updateActivity = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    }
  }, []);

  const checkSession = useCallback(async () => {
    // 1. Cookie gone? → expired
    const cookie = getCookie(SESSION_COOKIE);
    if (!cookie) {
      // Verify Supabase still has an active session before logging out
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // Session token was cleared externally — enforce sign-out
          await signOutAndRedirect();
          return;
        }
      }
      // No supabase session either — just redirect silently
      router.replace('/login');
      return;
    }

    // 2. Idle timeout check
    if (typeof localStorage !== 'undefined') {
      const last = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10);
      const idleMs = Date.now() - last;
      if (last > 0 && idleMs > IDLE_TIMEOUT_MS) {
        await signOutAndRedirect();
      }
    }
  }, [signOutAndRedirect, router]);

  useEffect(() => {
    // Record initial activity
    updateActivity();

    // Bind activity listeners once
    if (!activityBound.current) {
      activityBound.current = true;
      const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
      const handler = () => updateActivity();
      events.forEach(ev => window.addEventListener(ev, handler, { passive: true }));

      // Also check on window focus (user returning to tab)
      const onFocus = () => checkSession();
      window.addEventListener('focus', onFocus);

      return () => {
        events.forEach(ev => window.removeEventListener(ev, handler));
        window.removeEventListener('focus', onFocus);
      };
    }
  }, [updateActivity, checkSession]);

  useEffect(() => {
    // Run an initial check immediately
    checkSession();

    // Then check every 2 minutes
    checkIntervalRef.current = setInterval(checkSession, 2 * 60 * 1000);
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkSession]);
}
