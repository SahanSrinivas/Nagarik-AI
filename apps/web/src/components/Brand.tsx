import { Sparkles } from "lucide-react";

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`relative grid place-items-center ${dim} rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow`}
      >
        <Sparkles className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span className={`font-semibold tracking-tightest text-ink-900 ${text}`}>NagarikAI</span>
    </div>
  );
}
