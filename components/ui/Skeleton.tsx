'use client';

/**
 * Skeleton loader primitive. Replaces 'Loading…' text across the
 * platform with a shimmering placeholder shape that matches the
 * outgoing layout, so the page doesn't jolt when content arrives.
 *
 * Pure styled <span> / <div>. Three named variants cover the
 * common cases (text line, avatar circle, full card). Custom shapes
 * use <Skeleton className="..." /> directly.
 */

import { CSSProperties } from 'react';

export interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

const BASE = 'inline-block bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] bg-[length:200%_100%] animate-[skeleton-shimmer_1.4s_ease-in-out_infinite] rounded-md';

export function Skeleton({ className, style }: SkeletonProps) {
  return <span aria-busy="true" aria-live="polite" className={`${BASE} ${className ?? ''}`} style={style} />;
}

export function SkeletonText({ width = '100%' }: { width?: string }) {
  return <Skeleton className="h-3 align-middle" style={{ width }} />;
}

export function SkeletonAvatar({ size = 32 }: { size?: number }) {
  return <Skeleton className="rounded-full" style={{ width: size, height: size }} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3" aria-busy="true">
      <div className="flex items-center gap-3">
        <SkeletonAvatar size={36} />
        <SkeletonText width="40%" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonText key={i} width={`${85 - i * 10}%`} />
      ))}
    </div>
  );
}
