"use client";

import { Download, Share2, Sparkles } from "lucide-react";
import { useState } from "react";

/**
 * Viral before/after share button — Web Share API with the generated PNG.
 *
 * The PNG is rendered server-side by routes/share.py from before/after
 * photos + the elapsed-time badge. The URL is `share_image_url` on the
 * issue (relative path the backend sets when ResolutionAgent verifies).
 *
 * Behaviour ladder:
 *   1. Try `navigator.share({ files: [...] })` — opens native share sheet
 *      with the image attached. Works on iOS Safari + Android Chrome.
 *   2. Fall back to `navigator.share({ url, text })` — text-only share on
 *      desktop browsers that don't support files in Web Share Level 2.
 *   3. Last resort: open the PNG in a new tab so the citizen can save +
 *      share manually.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function ShareFixButton({
  issueId,
  shareImagePath,
  resolvedAt,
  createdAt,
  issueType,
}: {
  issueId: string;
  shareImagePath: string | null | undefined;
  resolvedAt: string | null;
  createdAt: string | null;
  issueType: string;
}) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  if (!shareImagePath) return null;

  const fullUrl = shareImagePath.startsWith("http")
    ? shareImagePath
    : `${BASE}${shareImagePath}`;

  const hours = (() => {
    if (!resolvedAt || !createdAt) return null;
    const ms = new Date(resolvedAt).getTime() - new Date(createdAt).getTime();
    if (Number.isNaN(ms) || ms < 0) return null;
    return Math.round(ms / (1000 * 60 * 60));
  })();

  const text =
    `Fixed${hours ? ` in ${hours}h` : ""}: ${issueType.replace(/_/g, " ")} ` +
    `in my neighbourhood — reported via NagarikAI.`;

  async function share() {
    setBusy(true); setHint(null);
    try {
      const blob = await fetch(fullUrl, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`fetch ${r.status}`);
        return r.blob();
      });
      const file = new File([blob], `nagarik-fix-${issueId.slice(0, 8)}.png`, {
        type: "image/png",
      });

      const navAny = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: ShareData & { files?: File[] }) => Promise<void>;
      };

      if (navAny.share && navAny.canShare && navAny.canShare({ files: [file] })) {
        await navAny.share({ files: [file], text, title: "Fixed via NagarikAI" });
      } else if (navAny.share) {
        await navAny.share({ text, url: fullUrl, title: "Fixed via NagarikAI" });
      } else {
        window.open(fullUrl, "_blank");
        setHint("Image opened in a new tab — save and share from there.");
      }
    } catch (e) {
      // User cancelling the share sheet throws AbortError — silent ignore.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setHint("Couldn't open the share sheet — try the download button.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={share}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white"
        style={{ background: "linear-gradient(135deg, #6366f1, #ec4899)" }}
      >
        <Share2 className="h-4 w-4" />
        {busy ? "Preparing…" : "Share fix"}
        <Sparkles className="h-3 w-3 opacity-80" />
      </button>
      <a
        href={fullUrl}
        download={`nagarik-fix-${issueId.slice(0, 8)}.png`}
        className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-xs"
        style={{ color: "rgb(var(--text-muted))" }}
      >
        <Download className="h-3.5 w-3.5" /> PNG
      </a>
      {hint && (
        <span className="text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
