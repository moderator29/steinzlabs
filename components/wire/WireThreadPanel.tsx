'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, MessagesSquare } from 'lucide-react';
import { WirePostCard, type WirePost } from './WirePostCard';
import { WireThread } from './WireThread';

/**
 * WireThreadPanel - the reply thread as a focused surface that opens ONLY when
 * the comment icon is tapped. On desktop/tablet it slides in as a right-side
 * panel; on mobile it is a full-screen sheet. It shows the parent wire at the
 * top (with its live actions) and the connected reply thread below.
 */
export interface WireThreadPanelProps {
  post: WirePost;
  currentUserId?: string | null;
  authorAvatarUrl?: string | null;
  authorDisplayName?: string | null;
  onClose: () => void;
  onLike: (post: WirePost) => void;
  onRepost: (post: WirePost) => void;
  onGift: (post: WirePost) => void;
  onDelete?: (post: WirePost) => void;
  onMute?: (post: WirePost, mute: boolean) => void;
  muted?: boolean;
  onHashtag?: (tag: string) => void;
  onCountDelta?: (delta: number) => void;
}

export function WireThreadPanel({
  post,
  currentUserId,
  authorAvatarUrl,
  authorDisplayName,
  onClose,
  onLike,
  onRepost,
  onGift,
  onDelete,
  onMute,
  muted,
  onHashtag,
  onCountDelta,
}: WireThreadPanelProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Reply thread"
      >
        <motion.div
          key="panel"
          initial={reduced ? { opacity: 0 } : { x: '100%' }}
          animate={reduced ? { opacity: 1 } : { x: 0 }}
          exit={reduced ? { opacity: 0 } : { x: '100%' }}
          transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[440px] sm:max-w-[92vw] flex flex-col nl-glass border-s border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
            <MessagesSquare className="w-4.5 h-4.5 text-[#4d94ff]" />
            <span className="font-semibold text-white text-sm">Thread</span>
            <button
              type="button"
              onClick={onClose}
              className="ms-auto p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition"
              aria-label="Close thread"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-3">
            <WirePostCard
              post={post}
              currentUserId={currentUserId}
              onLike={onLike}
              onRepost={onRepost}
              onGift={onGift}
              onDelete={onDelete}
              onMute={onMute}
              muted={muted}
              onHashtag={onHashtag}
            />
            <WireThread
              postId={post.id}
              currentUserId={currentUserId ?? null}
              authorAvatarUrl={authorAvatarUrl ?? null}
              authorDisplayName={authorDisplayName ?? null}
              onGift={onGift}
              onCountDelta={onCountDelta}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default WireThreadPanel;
