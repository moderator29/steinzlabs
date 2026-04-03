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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.sessionKey,
    });

    if (signInError) {
      return { success: false, error: 'Failed to establish session' };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('naka_has_session', 'true');
    }

    return { success: true };
  } catch (err: any) {
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      return { success: false, error: 'Sign-in cancelled' };
    }
    if (err?.code === 'auth/popup-blocked') {
      return { success: false, error: 'Pop-up was blocked. Please allow pop-ups for this site.' };
    }
    console.error('Social auth error:', err);
    return { success: false, error: err?.message || 'Sign-in failed. Please try again.' };
  }
}
