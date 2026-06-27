'use client';

import { useRouter } from 'next/navigation';
import { MessageCircle, Lock } from 'lucide-react';

/**
 * MessageButton — fully open-DM model. Anyone can message anyone; an unfollowed
 * recipient simply receives it in their Requests queue. The button is only
 * disabled when there's a block. Styled as a wide glass pill with the neon-blue
 * edge to match the profile's stat containers.
 */

export interface MessageButtonProps {
  peerId: string;
  permission: 'allowed' | 'blocked' | string;
  className?: string;
}

export function MessageButton({ peerId, permission, className }: MessageButtonProps) {
  const router = useRouter();
  const blocked = permission === 'blocked';
  return (
    <button
      type="button"
      onClick={() => !blocked && router.push(`/dashboard/messages/${peerId}`)}
      disabled={blocked}
      title={blocked ? 'You cannot message this user' : 'Send a message'}
      aria-label={blocked ? 'You cannot message this user' : 'Send a message'}
      className={`nl-glass inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition ${
        blocked ? 'text-white/40 cursor-not-allowed' : 'text-white hover:-translate-y-px'
      } ${className ?? ''}`}
      style={blocked ? undefined : { boxShadow: '0 0 0 1px rgba(0,102,255,.5), 0 0 16px rgba(0,102,255,.22)' }}
    >
      {blocked ? <Lock className="w-4 h-4" /> : <MessageCircle className="w-4 h-4 text-blue-300" />}
      Message
    </button>
  );
}
