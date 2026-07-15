'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Presence heartbeat. While a signed-in user has the app open, ping the server
 * every ~60s (and whenever the tab becomes visible) so others can see them as
 * online and "came online" alerts can fire. Renders nothing.
 */
export function PresenceHeartbeat() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const ping = () => { fetch('/api/presence', { method: 'POST' }).catch(() => {}); };
    ping();
    const id = setInterval(ping, 60_000);
    const onVis = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [user]);
  return null;
}

export default PresenceHeartbeat;
