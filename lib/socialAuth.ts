'use client';

import { supabase } from '@/lib/supabase';

export type SocialProvider = 'google' | 'apple';

export async function socialSignIn(provider: SocialProvider): Promise<{ success: boolean; error?: string }> {
  try {
    const { getFirebaseAuth, getGoogleProvider, getAppleProvider } = await import('@/lib/firebase');
    const { signInWithPopup } = await import('firebase/auth');

    const auth = await getFirebaseAuth();
    const firebaseProvider = provider === 'google'
      ? await getGoogleProvider()
      : await getAppleProvider();

    const result = await signInWithPopup(auth, firebaseProvider);
    const user = result.user;

    if (!user.email) {
      return { success: false, error: 'No email returned from provider' };
    }

    const idToken = await user.getIdToken();

    const res = await fetch('/api/auth/social-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        provider,
        displayName: user.displayName || '',
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Social login failed' };
    }

    if (!data.sessionKey || !data.email) {
      return { success: false, error: 'Invalid server response' };
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.sessionKey,
    });

    if (signInError) {
      return { success: false, error: 'Failed to establish session' };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('steinz_has_session', 'true');
      if (signInData?.session?.access_token) {
        document.cookie = `steinz_session=${signInData.session.access_token}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`;
      }
    }

    return { success: true };
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { success: false, error: 'Sign-in cancelled' };
    }
    if (code === 'auth/popup-blocked') {
      return { success: false, error: 'Pop-up was blocked. Please allow pop-ups for this site.' };
    }
    if (code === 'auth/unauthorized-domain') {
      return { success: false, error: 'This domain is not authorized for sign-in. Contact support.' };
    }
    if (code === 'auth/operation-not-allowed') {
      return { success: false, error: `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not enabled yet.` };
    }
    if (code === 'auth/network-request-failed') {
      return { success: false, error: 'Network error. Check your connection and try again.' };
    }
    if (code === 'auth/internal-error' || code === 'auth/web-storage-unsupported') {
      return { success: false, error: 'Browser not supported. Try a different browser or enable cookies.' };
    }
    console.error('Social auth error:', code, err?.message);
    return { success: false, error: err?.message || 'Sign-in failed. Please try again.' };
  }
}
