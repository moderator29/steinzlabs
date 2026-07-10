'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Heart, MessageCircle, Repeat2, Gift } from 'lucide-react';
import { formatWireCount } from '@/lib/wire/format';
import type { WirePost } from './WirePostCard';

/**
 * WireActionBar - the sleek segmented-glass control holding
 * Like / Comment / Relay / Tip. Each action plays a tasteful burst on tap and
 * its count rolls when it changes. Tip is emerald-accented (value). Minimal and
 * clean, tighter on mobile and airier on desktop. Honors reduced motion.
 */

// A vertically rolling count so a bumped number slides rather than snaps.
function RollingCount({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const label = formatWireCount(value);
  if (reduced) return <span className="tabular-nums">{label}</span>;
  return (
    <span className="relative inline-flex h-[1.15em] overflow-hidden align-middle tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={label}
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-110%', opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="block"
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// Radial particle burst played once when an action toggles on.
function Burst({ show, color }: { show: number; color: string }) {
  const reduced = useReducedMotion();
  if (reduced || !show) return null;
  const dots = Array.from({ length: 6 });
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        return (
          <motion.span
            key={`${show}-${i}`}
            className="absolute w-1 h-1 rounded-full"
            style={{ background: color }}
            initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
            animate={{ x: Math.cos(angle) * 12, y: Math.sin(angle) * 12, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        );
      })}
    </span>
  );
}

interface SegmentProps {
  icon: React.ReactNode;
  count?: number | null;
  active?: boolean;
  activeClass: string;
  /** Resting colour when not active (defaults to a muted white). */
  baseClass?: string;
  hoverClass: string;
  label: string;
  onClick: () => void;
  burstColor?: string;
  burstKey?: number;
}

function Segment({ icon, count, active, activeClass, baseClass, hoverClass, label, onClick, burstColor, burstKey }: SegmentProps) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      whileTap={reduced ? undefined : { scale: 0.9 }}
      className={`group relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3 text-[13px] transition ${
        active ? activeClass : `${baseClass ?? 'text-white/50'} ${hoverClass}`
      }`}
    >
      <span className="relative inline-flex">
        {burstColor ? <Burst show={burstKey ?? 0} color={burstColor} /> : null}
        {icon}
      </span>
      {typeof count === 'number' ? <RollingCount value={count} /> : null}
    </motion.button>
  );
}

export interface WireActionBarProps {
  post: WirePost;
  onLike: (post: WirePost) => void;
  onRepost: (post: WirePost) => void;
  onGift: (post: WirePost) => void;
  onComment?: (post: WirePost) => void;
  threadOpen?: boolean;
  compact?: boolean;
}

export function WireActionBar({ post, onLike, onRepost, onGift, onComment, threadOpen, compact }: WireActionBarProps) {
  const [likeBurst, setLikeBurst] = useState(0);
  const [relayBurst, setRelayBurst] = useState(0);

  const handleLike = () => {
    if (!post.liked) setLikeBurst((b) => b + 1);
    onLike(post);
  };
  const handleRepost = () => {
    if (!post.reposted) setRelayBurst((b) => b + 1);
    onRepost(post);
  };

  return (
    <div
      className={`mt-3 inline-flex items-center gap-0.5 rounded-full nl-glass p-0.5 ${compact ? 'scale-[0.96] origin-left' : ''}`}
    >
      <Segment
        label="Like"
        icon={<Heart className={`w-[18px] h-[18px] ${post.liked ? 'fill-current' : ''}`} />}
        count={post.like_count}
        active={!!post.liked}
        activeClass="text-red-400"
        hoverClass="hover:text-red-400 hover:bg-red-500/10"
        onClick={handleLike}
        burstColor="#f87171"
        burstKey={likeBurst}
      />

      {onComment ? (
        <Segment
          label="Comment"
          icon={<MessageCircle className="w-[18px] h-[18px]" />}
          count={post.reply_count}
          active={!!threadOpen}
          activeClass="text-[#4d94ff]"
          hoverClass="hover:text-[#4d94ff] hover:bg-[#0066FF]/12"
          onClick={() => onComment(post)}
        />
      ) : null}

      <Segment
        label="Relay"
        icon={<Repeat2 className="w-[18px] h-[18px]" />}
        count={post.repost_count}
        active={!!post.reposted}
        activeClass="text-emerald-400"
        hoverClass="hover:text-emerald-400 hover:bg-emerald-500/10"
        onClick={handleRepost}
        burstColor="#34d399"
        burstKey={relayBurst}
      />

      <Segment
        label="Tip"
        icon={<Gift className="w-[18px] h-[18px]" />}
        count={post.gift_count}
        activeClass="text-emerald-300"
        baseClass="text-emerald-300/80"
        hoverClass="hover:text-emerald-300 hover:bg-emerald-500/10"
        onClick={() => onGift(post)}
      />
    </div>
  );
}

export default WireActionBar;
