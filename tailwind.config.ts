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
        background: "#0B0D14",
        surface: "#12141D",
        card: "#161822",
        elevated: "#1C1F2E",
        border: "#232637",
        "border-subtle": "#1A1D2B",
        accent: "#00D4AA",
        "accent-secondary": "#6366F1",
        cyan: "#00D4AA",
        purple: "#6366F1",
        success: "#22C55E",
        warning: "#EAB308",
        danger: "#EF4444",
        muted: "#6B7280",
        "text-primary": "#F9FAFB",
        "text-secondary": "#9CA3AF",
        "text-tertiary": "#6B7280",
      },
      fontFamily: {
        heading: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
