"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { smartBack } from "@/lib/navigation/smartBack";

interface BackButtonProps {
  /**
   * FALLBACK route used only when there is no in-app history to go back to
   * (cold deep-link / new tab / share page). Real in-app history always
   * wins — matching PageHeader's `backTo` — so Back returns to the page the
   * user actually came from instead of the hardcoded href. Pass
   * `forceHref` if you truly need to jump to a fixed destination.
   */
  href?: string;
  /** Force navigation to `href` regardless of history (rare). */
  forceHref?: boolean;
  label?: string;
  className?: string;
  /**
   * Compact icon-only variant — a small, em-dash-sized chevron used across the
   * Whale Tracker headers where the full padded button is too heavy.
   */
  compact?: boolean;
}

export function BackButton({ href, forceHref = false, label, className = "", compact = false }: BackButtonProps) {
  const router = useRouter();
  const handleClick = () => {
    if (href && forceHref) {
      router.push(href);
      return;
    }
    // Was decided by document.referrer, which Next.js client navigations
    // (router.push/Link) never update — so it always fell through to the
    // fallback, the exact "back dumps me on the dashboard" bug. smartBack
    // walks the real in-app nav-depth counter and only uses `href` (default
    // /dashboard) on a cold entry with no history.
    smartBack(router, href ?? "/dashboard");
  };

  if (compact) {
    return (
      <motion.button
        onClick={handleClick}
        whileHover={{ x: -1 }}
        whileTap={{ scale: 0.9 }}
        aria-label={label || "Go back"}
        className={`group inline-flex items-center justify-center h-8 w-8 rounded-lg nl-glass border border-white/10 text-slate-400 hover:text-[#0066FF] hover:border-[#0066FF]/40 transition-colors ${className}`}
      >
        <ArrowLeft size={15} className="transition-colors" />
      </motion.button>
    );
  }

  // Default: a small square glass container around the icon (platform-wide
  // back-button spec) with the optional label sitting beside it.
  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ x: -2 }}
      whileTap={{ scale: 0.95 }}
      aria-label={label || "Go back"}
      className={`group inline-flex items-center gap-2 ${className}`}
    >
      <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg nl-glass border border-white/10 group-hover:border-[#0066FF]/40 transition-colors">
        <ArrowLeft size={16} className="text-slate-400 group-hover:text-[#0066FF] transition-colors" />
      </span>
      {label && <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>}
    </motion.button>
  );
}

export default BackButton;
