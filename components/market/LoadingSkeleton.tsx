'use client';

interface LoadingSkeletonProps {
  rows?: number;
  variant?: 'row' | 'card' | 'chart' | 'header';
}

const shimmer = 'animate-pulse bg-[#1E2433] rounded';

export function LoadingSkeleton({ rows = 5, variant = 'row' }: LoadingSkeletonProps) {
  if (variant === 'chart') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0A0E1A] rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${shimmer}`} />
          <div className={`w-24 h-3 ${shimmer}`} />
        </div>
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div className="flex items-center gap-4 p-4">
        <div className={`w-12 h-12 rounded-full ${shimmer}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-5 w-32 ${shimmer}`} />
          <div className={`h-4 w-20 ${shimmer}`} />
        </div>
        <div className="text-right space-y-2">
          <div className={`h-7 w-28 ${shimmer}`} />
          <div className={`h-4 w-16 ${shimmer}`} />
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`p-4 rounded-xl border border-[#1E2433] space-y-3 ${shimmer}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2A3343]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-24 bg-[#2A3343] rounded" />
            <div className="h-3 w-16 bg-[#2A3343] rounded" />
          </div>
        </div>
        <div className="h-6 w-32 bg-[#2A3343] rounded" />
        <div className="h-12 bg-[#2A3343] rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded">
          <div className={`w-8 h-8 rounded-full ${shimmer}`} />
          <div className="flex-1 space-y-1.5">
            <div className={`h-4 w-28 ${shimmer}`} />
            <div className={`h-3 w-16 ${shimmer}`} />
          </div>
          <div className={`h-4 w-20 ${shimmer}`} />
          <div className={`h-4 w-16 ${shimmer}`} />
        </div>
      ))}
    </div>
  );
}
