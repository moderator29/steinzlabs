"use client";

/**
 * HealthBadge — pill rendered in the admin top bar / sidebar that shows
 * platform infrastructure status at a glance. Polls /api/admin/health/summary
 * every 60s and:
 *   - GREEN dot when all checks active
 *   - AMBER dot + count when any check is degraded
 *   - RED dot (pulsing) + count when any check is in error
 * Click → /admin/api-health for the full table.
 *
 * If the badge fetch itself fails (e.g. admin token not in sessionStorage on
 * a fresh tab), the badge silently hides rather than showing fake green.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

interface CheckResult {
  name: string;
  status: "active" | "warning" | "error" | "inactive";
  latencyMs: number;
  message?: string;
}

interface SummaryData {
  overall: "active" | "warning" | "error";
  degradedCount: number;
  errorCount: number;
  checks: CheckResult[];
  checkedAt: string;
}

const POLL_MS = 60_000;

export function HealthBadge() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("admin_token") ?? "" : "";
        if (!token) {
          if (!cancelled) setHidden(true);
          return;
        }
        const res = await fetch("/api/admin/health/summary", {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setHidden(true);
          return;
        }
        const json = (await res.json()) as SummaryData;
        if (!cancelled) {
          setData(json);
          setHidden(false);
        }
      } catch {
        if (!cancelled) setHidden(true);
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (hidden || !data) return null;

  const tone =
    data.overall === "error"
      ? { ring: "border-red-500/40 bg-red-500/10 text-red-300", dot: "bg-red-500 animate-pulse", Icon: ShieldAlert }
      : data.overall === "warning"
        ? { ring: "border-amber-500/40 bg-amber-500/10 text-amber-300", dot: "bg-amber-500", Icon: AlertTriangle }
        : { ring: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300", dot: "bg-emerald-500", Icon: CheckCircle2 };

  const failing = data.checks.filter((c) => c.status === "error" || c.status === "warning");
  const headline =
    data.overall === "active"
      ? "All systems operational"
      : data.overall === "warning"
        ? `${data.degradedCount} service${data.degradedCount === 1 ? "" : "s"} degraded`
        : `${data.errorCount} service${data.errorCount === 1 ? "" : "s"} down`;

  return (
    <Link
      href="/admin/api-health"
      title={failing.map((c) => `${c.name}: ${c.message ?? c.status}`).join(" • ") || "All checks passing"}
      className={`group relative flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition hover:opacity-90 ${tone.ring}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      <tone.Icon className="w-3 h-3" />
      <span className="hidden sm:inline">{headline}</span>
      <span className="sm:hidden">
        {data.overall === "active" ? "OK" : `${data.errorCount + data.degradedCount}`}
      </span>
    </Link>
  );
}
