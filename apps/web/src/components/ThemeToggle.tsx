"use client";

import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";

const STORAGE_KEY = "nagarik.theme";

/**
 * Applies `.dark` to <html> based on user choice or system preference.
 * Matches the toggle pattern on srinivassahankolluri.com — light + dark
 * driven by CSS variables, no FOUC on reload because the script in
 * layout.tsx sets the class before paint.
 */
function applyMode(mode: Mode) {
  const wantsDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", wantsDark);
}

export function ThemeToggle({ className }: { className?: string }) {
  // Default = Light. Users can still cycle to Dark / System; this just
  // means a first-time visitor lands on the light palette instead of
  // inheriting their OS-level dark preference.
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const stored = (window.localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "light";
    setMode(stored);
    applyMode(stored);

    // Track OS-level changes when user is in "system" mode.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const cur = (window.localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "light";
      if (cur === "system") applyMode("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cycle = useCallback(() => {
    const next: Mode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyMode(next);
  }, [mode]);

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const label = mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System";

  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={cycle}
      title={`Theme: ${label} (click to cycle)`}
      aria-label={`Theme: ${label}`}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${className ?? ""}`}
      style={{
        color: "rgb(var(--text-primary))",
        backgroundColor: "rgb(var(--bg-surface))",
        border: "1px solid rgb(var(--border-color))",
      }}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}

/** Inline script — sets .dark BEFORE first paint to avoid theme FOUC. */
export const THEME_BOOT_SCRIPT = `
(function() {
  try {
    var s = localStorage.getItem('${STORAGE_KEY}') || 'light';
    var dark = s === 'dark' || (s === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`.trim();
