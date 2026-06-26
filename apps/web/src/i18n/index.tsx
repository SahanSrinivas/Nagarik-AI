"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import en from "./en.json";
import hi from "./hi.json";
import kn from "./kn.json";

// Strict map of bundled languages → their JSON. Adding a new language is:
//   1. python -m scripts.translate_ui --langs <code>
//   2. import here + add to BUNDLES
const BUNDLES = { en, hi, kn } as const;
export type Lang = keyof typeof BUNDLES;

export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "EN" },
  { code: "hi", label: "Hindi",   native: "हि" },
  { code: "kn", label: "Kannada", native: "ಕ" },
];

const STORAGE_KEY = "nagarik.lang";
const DEFAULT: Lang = "en";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
  ready: boolean;            // false until client-side hydration completes
}

const I18nContext = createContext<Ctx | null>(null);

function readInitial(): Lang {
  if (typeof window === "undefined") return DEFAULT;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && (stored in BUNDLES)) return stored as Lang;
  // Try browser language as a soft default.
  const nav = window.navigator.language.toLowerCase();
  if (nav.startsWith("hi")) return "hi";
  if (nav.startsWith("kn")) return "kn";
  return DEFAULT;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // SSR-safe two-phase hydration: server renders English, client's FIRST
  // render also serves English (ready=false), so React hydrates cleanly.
  // A useEffect then flips ready=true and the page re-renders with the
  // stored preference — no text-content mismatch warnings.
  const [lang, setLangState] = useState<Lang>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = readInitial();
    setLangState(next);
    setReady(true);
    try { document.documentElement.lang = next; } catch {}
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      // Before hydration, always serve English to match SSR output.
      const active = ready ? lang : DEFAULT;
      const bundle = BUNDLES[active] as unknown as Record<string, string>;
      if (key in bundle) return bundle[key];
      const enBundle = BUNDLES.en as unknown as Record<string, string>;
      if (key in enBundle) return enBundle[key];
      return fallback ?? key;
    },
    [lang, ready],
  );

  const value = useMemo(() => ({ lang, setLang, t, ready }), [lang, setLang, t, ready]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    // Failsafe so a missing provider in tests doesn't crash production.
    return {
      lang: DEFAULT,
      setLang: () => {},
      t: (key, fallback) => fallback ?? key,
      ready: false,
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
