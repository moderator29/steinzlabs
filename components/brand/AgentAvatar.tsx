"use client";
import Image from "next/image";

interface AgentAvatarProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export function AgentAvatar({ size = 32, animated = false, className = "" }: AgentAvatarProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-blue-500/30 ${animated ? "animate-pulse" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src="/logo.png" alt="Naka Labs AI" width={size} height={size} />
    </div>
  );
}

export default AgentAvatar;
