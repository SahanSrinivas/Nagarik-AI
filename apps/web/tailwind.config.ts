import type { Config } from "tailwindcss";

/**
 * Palette + typography lifted from srinivassahankolluri.com to keep
 * NagarikAI visually consistent with the rest of the founder's surface.
 *
 * Light + dark variants drive a CSS-variable theme; the .dark class on
 * <html> swaps them. Use the variable utilities (bg-surface, text-ink,
 * border-line) instead of hard-coded hex so dark mode just works.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1280px" } },
    extend: {
      fontFamily: {
        sans:    ["'Neutra Text Alt'", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Neutra Text Alt'", "system-ui", "-apple-system", "sans-serif"],
        mono:    ["'Courier New'", "ui-monospace", "Menlo", "monospace"],
      },
      letterSpacing: { tightest: "-0.02em" },

      // Static palette anchors — used by the rust accent (theme-invariant)
      // and the severity scale. Surface/text colors come from CSS vars below.
      colors: {
        accent: {
          DEFAULT: "#bf4f36",   // primary
          dark:    "#a3402b",   // primary-dark
          light:   "#d4664d",   // primary-light
        },
        severity: {
          1: "#10b981",
          2: "#84cc16",
          3: "#eab308",
          4: "#f97316",
          5: "#ef4444",
        },
        // CSS-variable bridges — `bg-surface`, `bg-canvas`, etc. all read
        // the live theme variables defined in globals.css.
        canvas:        "rgb(var(--bg-canvas) / <alpha-value>)",
        surface:       "rgb(var(--bg-surface) / <alpha-value>)",
        "surface-hover": "rgb(var(--bg-surface-hover) / <alpha-value>)",
        ink:           "rgb(var(--text-primary) / <alpha-value>)",
        muted:         "rgb(var(--text-secondary) / <alpha-value>)",
        subtle:        "rgb(var(--text-muted) / <alpha-value>)",
        line:          "rgb(var(--border-color) / <alpha-value>)",
        "line-soft":   "rgb(var(--border-light) / <alpha-value>)",

        // Keep legacy `brand-*` working — point it at the rust accent so we
        // don't have to chase every old className in this rebrand.
        brand: {
          50:  "#fbeae5",
          100: "#f4cbc1",
          200: "#eaa996",
          300: "#df876b",
          400: "#d4664d",   // light
          500: "#bf4f36",   // DEFAULT
          600: "#a3402b",   // dark
          700: "#883420",
          800: "#6d2918",
          900: "#52200f",
          DEFAULT: "#bf4f36",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
        lift: "0 4px 8px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)",
        glow: "0 0 0 1px rgba(191,79,54,0.25), 0 8px 32px rgba(191,79,54,0.18)",
      },
      backgroundImage: {
        // Hero gradient — solid dark in dark mode, soft light in light mode.
        "hero-gradient":
          "radial-gradient(60% 80% at 50% 0%, rgba(191,79,54,0.18) 0%, rgba(191,79,54,0) 60%), linear-gradient(180deg, #0a0a0a 0%, #111111 100%)",
        "mesh":
          "radial-gradient(at 8% 8%, rgba(191,79,54,0.20) 0px, transparent 50%), radial-gradient(at 92% 12%, rgba(255,255,255,0.06) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(191,79,54,0.10) 0px, transparent 50%)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%":   { boxShadow: "0 0 0 0 rgba(191,79,54,0.55)" },
          "70%":  { boxShadow: "0 0 0 12px rgba(191,79,54,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(191,79,54,0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up":    "fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        shimmer:      "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
