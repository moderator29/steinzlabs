"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
  /**
   * Compact icon-only variant — a small, em-dash-sized chevron used across the
   * Whale Tracker headers where the full padded button is too heavy.
   */
  compact?: boolean;
}

export function BackButton({ href, label, className = "", compact = false }: BackButtonProps) {
  const router = useRouter();
  const handleClick = () => {
    if (href) {
      router.push(href);
      return;
    }
    if (typeof window !== "undefined") {
      const referrer = document.referrer;
      let internalReferrer = false;
      if (referrer) {
        try {
          const url = new URL(referrer);
          internalReferrer =
            url.hostname === window.location.hostname &&
            !url.pathname.startsWith("/login") &&
            !url.pathname.startsWith("/signup") &&
            !url.pathname.startsWith("/auth");
        } catch {
          internalReferrer = false;
        }
      }
      if (internalReferrer && window.history.length > 1) {
        router.back();
        return;
      }
    }
    router.push("/dashboard");
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
