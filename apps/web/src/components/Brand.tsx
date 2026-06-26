/**
 * Brand mark — the same "community" symbol as the favicon, rendered inline.
 * Picks up the current theme: rust accent in light mode, white-on-dark in
 * dark mode. The mark itself stays consistent so favicon + header logo are
 * the same shape.
 */
export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`relative grid place-items-center ${dim} rounded-xl text-white`}
        style={{ backgroundColor: "rgb(var(--accent))" }}
        aria-hidden
      >
        <CommunitySymbol />
      </span>
      <span
        className={`font-semibold tracking-tightest ${text}`}
        style={{ color: "rgb(var(--text-primary))" }}
      >
        NagarikAI
      </span>
    </div>
  );
}

/**
 * Three figures around a shared centre — the same SVG that lives in
 * /public/favicon.svg, sized down. Inline (not <img>) so it inherits
 * stroke color and feels native to the surrounding chrome.
 */
function CommunitySymbol() {
  return (
    <svg viewBox="0 0 64 64" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="32" cy="32" r="3.2" fill="currentColor" />
      {/* top */}
      <circle cx="32" cy="14" r="5" fill="currentColor" />
      <path d="M22 30c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* bottom-left */}
      <circle cx="16.4" cy="40.8" r="5" fill="currentColor" />
      <path d="M9.4 51.3c1.43-4.96 6.04-8.66 11.39-9.06" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* bottom-right */}
      <circle cx="47.6" cy="40.8" r="5" fill="currentColor" />
      <path d="M54.6 51.3c-1.43-4.96-6.04-8.66-11.39-9.06" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
