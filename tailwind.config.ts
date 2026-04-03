import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0E1A",
        card: "#111827",
        elevated: "#1A2235",
        border: "#1F2937",
        "neon-blue": {
          DEFAULT: "#0A1EFF",
          50: "#E8EBFF",
          100: "#C5CCFF",
          200: "#8B99FF",
          300: "#5166FF",
          400: "#1733FF",
          500: "#0A1EFF",
          600: "#0818CC",
          700: "#061299",
          800: "#040C66",
          900: "#020633",
        },
        accent: {
          blue: "#0A1EFF",
          purple: "#7C3AED",
          magenta: "#E040FB",
          orange: "#FF6D00",
          pink: "#FF4081",
        },
        purple: "#7C3AED",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        surface: {
          DEFAULT: "#111827",
          light: "#1A2235",
          dark: "#0A0E1A",
          hover: "#1E2A3F",
        },
        muted: {
          DEFAULT: "#6B7280",
          foreground: "#9CA3AF",
        },
      },
      fontFamily: {
        heading: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "neon": "0 0 20px rgba(10, 30, 255, 0.3)",
        "neon-lg": "0 0 40px rgba(10, 30, 255, 0.4), 0 0 80px rgba(10, 30, 255, 0.1)",
        "neon-sm": "0 0 10px rgba(10, 30, 255, 0.2)",
        "neon-blue-glow": "0 0 30px rgba(10, 30, 255, 0.25), 0 8px 32px rgba(10, 30, 255, 0.15)",
        "card-hover": "0 8px 32px rgba(10, 30, 255, 0.1), 0 2px 8px rgba(0, 0, 0, 0.3)",
        "depth": "0 2px 4px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.15), 0 16px 32px rgba(0,0,0,0.1)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-glow": "pulseGlow 2s infinite",
        "neon-pulse": "neonPulse 3s ease-in-out infinite",
        "shimmer": "shimmer 3s linear infinite",
        "fade-slide-in": "fadeSlideIn 0.5s ease-out forwards",
        "glow-pulse": "glowPulse 4s ease-in-out infinite",
        "marquee": "marquee 30s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(10, 30, 255, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(10, 30, 255, 0.6)" },
        },
        neonPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(10, 30, 255, 0.2), 0 0 60px rgba(10, 30, 255, 0.05)" },
          "50%": { boxShadow: "0 0 40px rgba(10, 30, 255, 0.4), 0 0 80px rgba(10, 30, 255, 0.15)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        fadeSlideIn: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(10, 30, 255, 0.1), 0 0 60px rgba(10, 30, 255, 0.05)" },
          "50%": { boxShadow: "0 0 40px rgba(10, 30, 255, 0.2), 0 0 80px rgba(10, 30, 255, 0.1), 0 0 120px rgba(124, 58, 237, 0.05)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
