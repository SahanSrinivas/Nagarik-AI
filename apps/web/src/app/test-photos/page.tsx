"use client";

import { motion } from "framer-motion";
import { Copy, Download, FlaskConical, MapPin, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";

interface Case {
  id: string;
  title: string;
  ward: string;
  lat: number;
  lng: number;
  before: string;
  after: string;
  referenceVerdict: string;
  referenceTone: "brand" | "amber" | "rose";
  expectations: string[];
}

const CASES: Case[] = [
  { id: "A", title: "Genuine fix, same spot — pothole gone", ward: "Hemmigepura",
    lat: 12.88, lng: 77.51,
    before: "/test-photos/case_a_reported.jpg", after: "/test-photos/case_a_resolved.jpg",
    referenceVerdict: "VERIFIED", referenceTone: "brand",
    expectations: ["scene_similarity ≈ 0.92", "defect before≈0.97 → after≈0.04", "verdict: verified_resolved"] },
  { id: "B", title: "Photo from a different location (1.7 km away)", ward: "Horamavu",
    lat: 13.05, lng: 77.65,
    before: "/test-photos/case_b_reported.jpg", after: "/test-photos/case_b_resolved.jpg",
    referenceVerdict: "REJECTED (still defective)", referenceTone: "rose",
    expectations: ["scene_similarity ≈ 0.64", "defect_after ≈ 0.98", "verdict: rejected_still_defective"] },
  { id: "C", title: "Right GPS, wrong photo", ward: "Begur",
    lat: 12.86, lng: 77.63,
    before: "/test-photos/case_c_reported.jpg", after: "/test-photos/case_c_resolved.jpg",
    referenceVerdict: "REJECTED (scene mismatch)", referenceTone: "rose",
    expectations: ["scene_similarity ≈ 0.41 (below floor)", "verdict: rejected_photo_swap"] },
  { id: "D", title: "Same spot, reused older photo of fixed road", ward: "Bellanduru",
    lat: 12.94, lng: 77.67,
    before: "/test-photos/case_d_reported.jpg", after: "/test-photos/case_d_resolved.jpg",
    referenceVerdict: "REVIEW", referenceTone: "amber",
    expectations: ["scene_similarity ≈ 0.92", "defect_after ≈ 0.21 (mid)", "verdict: needs_review"] },
  { id: "E", title: "Same spot but NOT actually fixed", ward: "Jakkuru",
    lat: 13.07, lng: 77.62,
    before: "/test-photos/case_e_reported.jpg", after: "/test-photos/case_e_resolved.jpg",
    referenceVerdict: "REJECTED (still defective)", referenceTone: "rose",
    expectations: ["scene_similarity ≈ 1.00 (identical)", "verdict: rejected_still_defective"] },
];

interface CategoryCard {
  cat: string;
  label: string;
  ward: string;
  lat: number;
  lng: number;
}

// Real photos downloaded from Wikimedia Commons (CC-BY-SA) per category.
// The "after" image is a synthetic ✓ card we generated programmatically so
// the ResolutionAgent has something to score in demos.
const CATEGORY_CARDS: CategoryCard[] = [
  { cat: "garbage",      label: "Garbage / waste",              ward: "BTM Layout",   lat: 12.9166, lng: 77.6101 },
  { cat: "streetlight",  label: "Broken streetlight",            ward: "Indiranagar",  lat: 12.9716, lng: 77.6412 },
  { cat: "water_leak",   label: "Burst pipe / water leak",        ward: "Jayanagar",    lat: 12.9279, lng: 77.5832 },
  { cat: "sewage",       label: "Open manhole / sewage",          ward: "Malleshwaram", lat: 13.0036, lng: 77.5712 },
  { cat: "tree_fall",    label: "Fallen tree",                    ward: "Hebbal",       lat: 13.0358, lng: 77.5970 },
  { cat: "encroachment", label: "Encroachment / street vendor",   ward: "Hongasandra",  lat: 12.8915, lng: 77.6263 },
];

export default function TestPhotosPage() {
  const [copied, setCopied] = useState<string | null>(null);
  // Origin set after mount so SSR + first client render agree.
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text); setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
      <header className="card p-6">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
          <h1 className="text-xl font-semibold tracking-tight">Test photos</h1>
        </div>
        <p className="mt-1 text-sm text-ink-600">
          Two banks: <strong>real labelled pothole pairs</strong> from the OpenCity dataset
          (drive the closure-audit verdicts) and <strong>real Wikimedia photos for the other
          6 categories</strong> (drive the agent pipeline across every issue type).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="brand">{CASES.length} pothole cases</Pill>
          <Pill tone="brand">{CATEGORY_CARDS.length} category photos · Wikimedia Commons</Pill>
        </div>
      </header>

      {/* ─── BANK 1: REAL POTHOLE PAIRS ─── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold text-ink-900">Real pothole cases (closure-audit suite)</h2>
          <Pill tone="brand">5 labelled before/after pairs</Pill>
        </div>
        <Stagger step={0.05} className="space-y-4">
          {CASES.map((c) => (
            <Reveal key={c.id}>
              <motion.div whileHover={{ y: -2 }} className="card overflow-hidden">
                <div className="border-b border-ink-100 bg-ink-50/60 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="brand">Case {c.id}</Pill>
                    <Pill tone="ink">{c.ward}</Pill>
                    <span className="font-mono text-xs text-ink-500">{c.lat.toFixed(3)}, {c.lng.toFixed(3)}</span>
                    <Pill tone={c.referenceTone} className="ml-auto">
                      <Sparkles className="h-3 w-3" /> Expected: {c.referenceVerdict}
                    </Pill>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-ink-900">{c.title}</div>
                </div>
                <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr_auto]">
                  <PhotoBlock label="Before (citizen reports this)" url={c.before} origin={origin}
                    onCopy={copy} copied={copied === origin + c.before} />
                  <PhotoBlock label="After (crew uploads this on /crew)" url={c.after} origin={origin}
                    onCopy={copy} copied={copied === origin + c.after} />
                  <div className="lg:w-60">
                    <div className="text-xs uppercase tracking-wider text-ink-500">What you should see</div>
                    <ul className="mt-2 space-y-1 text-xs text-ink-700">
                      {c.expectations.map((e) => (
                        <li key={e} className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: "rgb(var(--accent))" }} />
                          <span className="font-mono">{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* ─── BANK 2: CATEGORY PHOTOS (REAL WIKIMEDIA) ─── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold text-ink-900">Other 6 categories — real Wikimedia photos</h2>
          <Pill tone="brand">CC-BY-SA</Pill>
        </div>
        <p className="mb-3 text-xs text-ink-500">
          Real photographs sourced from Wikimedia Commons. Use these to drive the agent
          pipeline across every issue type. The "after" image is a synthetic ✓ card so the
          ResolutionAgent has something to compare against.
        </p>
        <Stagger step={0.04} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_CARDS.map((c) => {
            const before = `/test-photos/real_${c.cat}_reported.jpg`;
            const after  = `/test-photos/cat_${c.cat}_resolved.jpg`;
            const beforeUrl = origin + before;
            return (
              <Reveal key={c.cat}>
                <motion.div whileHover={{ y: -2 }} className="card overflow-hidden">
                  <div className="border-b border-ink-100 bg-ink-50/60 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="brand">{c.label}</Pill>
                      <Pill tone="ink">{c.ward}</Pill>
                      <span className="ml-auto font-mono text-ink-500">{c.lat.toFixed(3)}, {c.lng.toFixed(3)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-ink-100">
                    <div className="relative h-40 w-full overflow-hidden bg-ink-100">
                      <img src={before} alt="before (real)" className="h-full w-full object-cover" />
                      <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">REAL · before</span>
                    </div>
                    <div className="relative h-40 w-full overflow-hidden bg-ink-100">
                      <img src={after} alt="after (synthetic)" className="h-full w-full object-cover" />
                      <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">synthetic · after</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 p-3 text-xs">
                    <button onClick={() => copy(beforeUrl)}
                      className={`btn ${copied === beforeUrl ? "" : "btn-ghost"} text-xs`}
                      style={copied === beforeUrl ? { background: "rgba(191,79,54,0.10)", color: "rgb(var(--accent))" } : undefined}>
                      <Copy className="h-3.5 w-3.5" /> {copied === beforeUrl ? "Copied" : "Copy real URL"}
                    </button>
                    <a href={before} download className="btn btn-ghost text-xs">
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                    <a href="/report" className="btn-primary text-xs">
                      <MapPin className="h-3.5 w-3.5" /> Try this
                    </a>
                  </div>
                </motion.div>
              </Reveal>
            );
          })}
        </Stagger>
      </section>

      <div className="card p-5 text-xs text-ink-600">
        <strong>How to test:</strong> open <a href="/report" className="underline">/report</a>,
        click any Bengaluru ward chip, then either upload one of the photos above or paste the
        Copy-URL value into the photo field. Either path fires the full 7-agent pipeline.
      </div>
    </motion.div>
  );
}

function PhotoBlock({ label, url, origin, onCopy, copied }:
  { label: string; url: string; origin: string; onCopy: (s: string) => void; copied: boolean }) {
  const full = origin + url;
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
      <img src={url} alt="" className="mt-2 h-44 w-full rounded-xl border border-ink-200 object-cover" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => onCopy(full)}
          className={`btn ${copied ? "" : "btn-ghost"} text-xs`}
          style={copied ? { background: "rgba(191,79,54,0.10)", color: "rgb(var(--accent))" } : undefined}>
          <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy URL"}
        </button>
        <a href={url} download className="btn btn-ghost text-xs">
          <Download className="h-3.5 w-3.5" /> Download
        </a>
      </div>
    </div>
  );
}
