'use client';

import { useRouter } from 'next/navigation';
import { MessageCircle, Lock } from 'lucide-react';

/**
 * MessageButton — disabled with a tooltip when DM is not permitted.
 * The reason comes from the profile fetch (e.g., 'mutual', 'nobody',
 * 'blocked'). Click routes to /dashboard/messages/[peerId].
 */

export interface MessageButtonProps {
  peerId: string;
  permission: 'allowed' | 'not_mutual' | 'not_following' | 'nobody' | 'blocked' | 'suspended';
  size?: 'sm' | 'md';
  className?: string;
}

const REASON_TEXT: Record<MessageButtonProps['permission'], string> = {
  allowed:       'Send a message',
  not_mutual:    'Only mutual follows can DM this user',
  not_following: 'User only accepts DMs from people they follow',
  nobody:        'User has DMs disabled',
  blocked:       'You cannot message this user',
  suspended:     'This user is suspended from social features',
};

export function MessageButton({ peerId, permission, size = 'md', className }: MessageButtonProps) {
  const router = useRouter();
  const disabled = permission !== 'allowed';
  const base = size === 'sm' ? 'text-[11px] px-2.5 py-1 rounded-md' : 'text-[12px] px-3.5 py-1.5 rounded-lg';
  return (
    <button
      type="button"
      onClick={() => !disabled && router.push(`/dashboard/messages/${peerId}`)}
      disabled={disabled}
      title={REASON_TEXT[permission]}
      aria-label={REASON_TEXT[permission]}
      className={`inline-flex items-center gap-1.5 font-semibold transition-colors border ${base} ${
        disabled
          ? 'bg-white/[0.02] border-white/[0.06] text-gray-500 cursor-not-allowed'
          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 hover:border-[var(--nl-blue,#0A1EFF)]/40 text-slate-200'
      } ${className ?? ''}`}
    >
      {disabled ? <Lock className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
      Message
    </button>
  );
}
