import { clsx } from "clsx";
import type { ReactNode } from "react";

const TONES = {
  brand: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
  ink: "bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  blue: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  lime: "bg-lime-50 text-lime-700 ring-1 ring-inset ring-lime-200",
} as const;

export function Pill({
  children,
  tone = "ink",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return <span className={clsx("pill", TONES[tone], className)}>{children}</span>;
}

const SEVERITY_TONE: Record<number, keyof typeof TONES> = {
  1: "lime",
  2: "lime",
  3: "amber",
  4: "amber",
  5: "rose",
};

export function SeverityPill({ value }: { value: number }) {
  const v = Math.max(1, Math.min(5, value));
  return <Pill tone={SEVERITY_TONE[v]}>severity {v}</Pill>;
}

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  reported: "ink",
  classified: "blue",
  deduped: "ink",
  triaged: "blue",
  verified: "brand",
  scheduled: "amber",
  in_progress: "amber",
  resolved: "brand",
  closed: "ink",
  rejected: "rose",
};

export function StatusPill({ value }: { value: string }) {
  return <Pill tone={STATUS_TONE[value] ?? "ink"}>{value}</Pill>;
}
