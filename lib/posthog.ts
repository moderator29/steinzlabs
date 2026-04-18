import type { PostHog as PostHogType } from 'posthog-js';

let posthogInstance: PostHogType | null = null;

export function initPostHog(): PostHogType | null {
  if (typeof window === 'undefined') return null;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (posthogInstance) return posthogInstance;

  const PostHog = require('posthog-js').default;
  PostHog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    loaded: (ph: PostHogType) => {
      if (process.env.NODE_ENV === 'development') {
        ph.opt_out_capturing();
      }
    },
  });
  posthogInstance = PostHog;
  return PostHog;
}

export function getPostHog(): PostHogType | null {
  return posthogInstance;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  posthogInstance?.capture(event, properties);
}

export function identify(userId: string, properties?: Record<string, unknown>): void {
  posthogInstance?.identify(userId, properties);
}

export function resetUser(): void {
  posthogInstance?.reset();
}
