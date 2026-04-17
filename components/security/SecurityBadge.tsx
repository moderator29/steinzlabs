"use client";

import { Shield, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

export interface SecurityBadgeProps {
  score?: number | null; // 0-100
  level?: "safe" | "low" | "medium" | "high" | "critical" | null;
  size?: "sm" | "md";
  compact?: boolean;
}

export function SecurityBadge({ score, level, size = "sm", compact = false }: SecurityBadgeProps) {
  const effLevel: "safe" | "low" | "medium" | "high" | "critical" =
    level ??
    (score !== undefined && score !== null
      ? score >= 85 ? "safe" : score >= 65 ? "low" : score >= 40 ? "medium" : score >= 20 ? "high" : "critical"
      : "low");

  const config = {
    safe: { Icon: ShieldCheck, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", label: "Safe" },
    low: { Icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", label: "Low" },
    medium: { Icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", label: "Medium" },
    high: { Icon: ShieldAlert, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", label: "High" },
    critical: { Icon: ShieldX, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "Critical" },
  }[effLevel];

  const iconSize = size === "md" ? 12 : 10;
  const padding = size === "md" ? "px-2 py-1" : "px-1.5 py-0.5";
  const textSize = size === "md" ? "text-[11px]" : "text-[9px]";

  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} rounded border ${config.bg} ${config.color} ${textSize} uppercase tracking-wide font-semibold`}
      title={score !== undefined && score !== null ? `Security score: ${score}/100` : `Risk: ${config.label}`}
    >
      <config.Icon size={iconSize} />
      {!compact && <span>{config.label}</span>}
      {!compact && score !== undefined && score !== null && (
        <span className="font-mono opacity-80">{score}</span>
      )}
    </span>
  );
}

export default SecurityBadge;
