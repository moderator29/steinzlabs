"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

export function BackButton({ href, label, className = "" }: BackButtonProps) {
  const router = useRouter();
  const handleClick = () => {
    if (href) {
      router.push(href);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ x: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`group inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/50 hover:border-blue-500/30 transition-all ${className}`}
    >
      <ArrowLeft size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
      {label && <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>}
    </motion.button>
  );
}

export default BackButton;
