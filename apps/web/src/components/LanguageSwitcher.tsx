"use client";

import { motion } from "framer-motion";
import { Languages } from "lucide-react";
import { useState } from "react";

import { LANGS, useI18n, type Lang } from "@/i18n";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
        aria-label={t("common.choose_language", "Choose language")}
      >
        <Languages className="h-3.5 w-3.5 text-ink-500" />
        <span className="font-mono">{LANGS.find((l) => l.code === lang)?.native ?? "EN"}</span>
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lift"
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code as Lang); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-ink-50 ${
                l.code === lang ? "bg-brand-50 text-brand-700" : "text-ink-700"
              }`}
            >
              <span>{l.label}</span>
              <span className="font-mono text-xs text-ink-400">{l.native}</span>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
