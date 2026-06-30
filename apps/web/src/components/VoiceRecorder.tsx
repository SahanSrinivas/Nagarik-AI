"use client";

import { Mic, Square, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { uploadAudio } from "@/lib/api";

/**
 * Voice-first multimodal — records a Kannada/Hindi/English note from the
 * citizen's mic, uploads it to Supabase via /uploads/signed-url, and hands
 * the resulting public URL back to the parent form via `onUploaded`.
 *
 * Browser behaviour:
 *   - iOS (Safari): MediaRecorder ships m4a (audio/mp4). We let the
 *     browser pick its native mime so iOS/Android each get a container
 *     Gemini 2.5 Flash accepts natively.
 *   - Android/Chrome: webm-opus is the default. Both work.
 *
 * Hard-capped at 30s. The agent loop already enforces the same on the
 * server, but we surface the limit in the UI so citizens don't waste time.
 */

const MAX_DURATION_S = 30;

export function VoiceRecorder({
  onUploaded,
}: {
  onUploaded: (url: string | null) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "recorded" | "uploading" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Always release the mic when this component unmounts.
  useEffect(() => () => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function startRecording() {
    setErr(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErr("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setState("recorded");
      };
      rec.start();
      recorderRef.current = rec;
      setSeconds(0);
      setState("recording");
      tickerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_DURATION_S) {
            stopRecording();
            return MAX_DURATION_S;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      setErr(`Mic access blocked: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  function stopRecording() {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }

  async function upload() {
    if (!chunksRef.current.length) return;
    setState("uploading"); setErr(null);
    const mime = recorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    try {
      const url = await uploadAudio(blob, mime);
      onUploaded(url);
      setState("done");
    } catch (e) {
      setErr(`Upload failed: ${e instanceof Error ? e.message : "unknown"}`);
      setState("recorded");
    }
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    chunksRef.current = [];
    onUploaded(null);
    setState("idle");
    setSeconds(0);
  }

  const isBusy = state === "recording" || state === "uploading";

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.10) 0%, rgba(245, 158, 11, 0.04) 100%)",
        border: "1px solid rgba(245, 158, 11, 0.45)",
      }}
    >
      <div className="mb-2 flex items-start gap-2">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: "#f59e0b" }}
        >
          <Mic className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
            Voice-first reporting · Kannada / Hindi / English
          </div>
          <div className="mt-0.5 text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
            Tap to record a 30s note. Gemini 2.5 Flash processes your voice + photo together —
            no separate transcription step. Optional.
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            style={{ background: "#f59e0b", color: "white" }}
          >
            <Mic className="h-4 w-4" /> Record
          </button>
        )}
        {state === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium animate-pulse"
            style={{ background: "#dc2626", color: "white" }}
          >
            <Square className="h-4 w-4" /> Stop · {seconds}s
          </button>
        )}
        {(state === "recorded" || state === "uploading" || state === "done") && previewUrl && (
          <>
            <audio src={previewUrl} controls className="h-9" />
            {state !== "done" && (
              <button
                type="button"
                onClick={upload}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium"
                style={{ background: "rgb(var(--accent))", color: "white" }}
              >
                <Upload className="h-3.5 w-3.5" /> {state === "uploading" ? "Uploading…" : "Attach voice note"}
              </button>
            )}
            {state === "done" && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                style={{ background: "rgba(16, 185, 129, 0.18)", color: "#047857" }}>
                Attached
              </span>
            )}
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-xs"
              style={{ color: "rgb(var(--text-muted))" }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          </>
        )}
      </div>

      {err && (
        <div className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">{err}</div>
      )}
    </div>
  );
}
