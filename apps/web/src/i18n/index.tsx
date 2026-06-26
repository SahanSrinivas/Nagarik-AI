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
  // SSR-safe: server renders English first, client hydrates with stored preference.
  const [lang, setLangState] = useState<Lang>(DEFAULT);

  useEffect(() => {
    setLangState(readInitial());
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
      // Strict lookup, then English fallback, then literal key (during dev).
      const bundle = BUNDLES[lang] as Record<string, string>;
      if (key in bundle) return bundle[key];
      const en = BUNDLES.en as Record<string, string>;
      if (key in en) return en[key];
      return fallback ?? key;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
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
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
