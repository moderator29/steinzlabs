'use client';

import { useNavDepthTracker } from '@/lib/navigation/smartBack';

/** Renders nothing; keeps the in-app navigation depth counter that smartBack
 *  uses to decide between real history-back and the fallback route. */
export default function NavDepthTracker() {
  useNavDepthTracker();
  return null;
}
