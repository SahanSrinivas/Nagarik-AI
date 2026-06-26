"""Generate docs/NagarikAI_Project_Report.docx — a plain-English Word document
covering Abstract, Introduction, Problem Statement, Architecture (with pictures),
Results (with pictures), and Conclusion.

Run:
    .venv/bin/python scripts/build_report_docx.py
"""

from __future__ import annotations

import os
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
OUT  = ROOT / "docs" / "NagarikAI_Project_Report.docx"
PHOTOS = ROOT / "apps" / "web" / "public" / "test-photos"

ACCENT = RGBColor(0xBF, 0x4F, 0x36)  # rust
INK    = RGBColor(0x18, 0x18, 0x1B)


def _shade(cell, hex_color: str) -> None:
    """Set table-cell background to a hex colour."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def h1(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(22)
    run.font.color.rgb = ACCENT


def h2(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(16)
    run.font.color.rgb = INK
    p.paragraph_format.space_before = Pt(14)


def h3(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(13)
    run.font.color.rgb = ACCENT


def p(doc: Document, text: str) -> None:
    para = doc.add_paragraph(text)
    para.paragraph_format.space_after = Pt(6)
    for r in para.runs:
        r.font.size = Pt(11)


def bullets(doc: Document, items: list[str]) -> None:
    for it in items:
        para = doc.add_paragraph(it, style="List Bullet")
        for r in para.runs:
            r.font.size = Pt(11)


def code(doc: Document, text: str) -> None:
    para = doc.add_paragraph()
    run = para.add_run(text)
    run.font.name = "Courier New"
    run.font.size = Pt(9)
    para.paragraph_format.left_indent = Inches(0.25)


def img(doc: Document, path: Path, caption: str, width_in: float = 5.5) -> None:
    if not path.exists():
        return
    doc.add_picture(str(path), width=Inches(width_in))
    last = doc.paragraphs[-1]
    last.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap.add_run(f"Figure — {caption}")
    r.italic = True
    r.font.size = Pt(9)
    r.font.color.rgb = RGBColor(0x6E, 0x6E, 0x73)


def table(doc: Document, headers: list[str], rows: list[list[str]]) -> None:
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Light Grid Accent 1"
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = h
        _shade(cell, "BF4F36")
        for r in cell.paragraphs[0].runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)
    for ri, row in enumerate(rows, start=1):
        for ci, val in enumerate(row):
            t.rows[ri].cells[ci].text = val
            for r in t.rows[ri].cells[ci].paragraphs[0].runs:
                r.font.size = Pt(10)


def build() -> None:
    doc = Document()

    # ─── Title page ─────────────────────────────────────────────
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run("NagarikAI")
    r.bold = True
    r.font.size = Pt(40)
    r.font.color.rgb = ACCENT

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run("Multi-Agent Civic OS for Hyperlocal India")
    r.italic = True
    r.font.size = Pt(14)
    r.font.color.rgb = INK

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = meta.add_run("Coding Ninjas — Community Hero Challenge · 2026")
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor(0x6E, 0x6E, 0x73)

    doc.add_page_break()

    # ─── Abstract ───────────────────────────────────────────────
    h1(doc, "Abstract")
    p(doc,
      "NagarikAI is a multi-agent civic platform that lets a citizen in Bengaluru take a "
      "photo or short video of a civic problem — a pothole, a broken streetlight, an overflowing "
      "drain — and turns it into a tracked, accountable ticket without filling a form, without "
      "calling a helpline, and without dropping into six different BBMP / BWSSB / BESCOM portals.")
    p(doc,
      "Behind the simple submit button, seven AI agents (Vision · Dedup · Triage · Verification · "
      "Scheduler · Resolution · Insights) classify the issue, dedupe it against nearby reports, "
      "route it to the correct department with a deterministic gate, schedule a crew using a MILP "
      "shortest-path optimiser, and audit the closure photo with CLIP and a pothole CNN. Every "
      "status change pings the citizen on the in-app timeline and — if they opt in — on WhatsApp.")
    p(doc,
      "The system was built on real Bengaluru data: 127,000 complaints across 243 BBMP wards, "
      "60 months of IMD rainfall, 14,580 ward-month observations. The MILP scheduler cuts crew "
      "kilometres by 89.5% versus the city's current FIFO-style dispatch on the same 800-issue "
      "load. The Gemini Vision agent correctly classifies all 7 issue categories in a 7-video "
      "probe, and the closure CNN reaches 92% test accuracy on a real pothole dataset.")

    # ─── Introduction ───────────────────────────────────────────
    h1(doc, "Introduction")
    p(doc,
      "Communities frequently face issues such as potholes, water leakages, damaged streetlights, "
      "waste management concerns, and public infrastructure challenges. The traditional path — "
      "find the right app, fill the right form, follow up, hope — is fragmented, opaque, and "
      "exhausting. Most citizens give up after one bad experience.")
    p(doc,
      "Bengaluru's BBMP alone receives roughly 127,000 complaints every six months, and around "
      "15% remain unresolved at any given time. Citizens have learned to distrust the apps that "
      "exist, crews close tickets without fixing them, and the system measures activity rather "
      "than outcomes.")
    p(doc,
      "NagarikAI was built for the Coding Ninjas Community Hero Challenge as a thin, fast, "
      "AI-driven front door that sits in front of these existing systems. We don't replace BBMP; "
      "we make the existing pipeline visible, accountable, and fast — to citizens, to crews, "
      "and to the departments themselves.")

    # ─── Problem Statement ──────────────────────────────────────
    h1(doc, "Problem Statement")
    p(doc,
      "Build a platform that lets citizens identify, report, validate, track, and resolve "
      "community issues through collaboration, data, and intelligent automation — and that "
      "encourages transparency, accountability, and community participation.")
    h3(doc, "Three pain points NagarikAI targets directly:")
    bullets(doc, [
        "Fragmented reporting — BBMP runs at least half a dozen apps and a helpline; citizens "
        "don't know which one to use, so they don't.",
        "Fake closures — crews mark tickets resolved by uploading a photo of a different street; "
        "no one audits, so the same pothole gets reported eight times.",
        "Slow + wasteful dispatch — crews drive ~23% more kilometres than they need to; ambulances "
        "overturn in potholes that have been reported for weeks.",
    ])

    h3(doc, "Brief feature checklist (all eight delivered):")
    table(doc,
          ["Brief feature", "How NagarikAI implements it"],
          [
              ["Image AND video-based issue reporting",
               "/report has a Photo|Video toggle. Photos go inline to Gemini; videos upload to the Gemini Files API."],
              ["AI-powered issue categorization",
               "Gemini 2.5 Flash assigns one of 8 categories + severity 1-5; Claude Haiku 4.5 proposes routing; a deterministic SOP gate verifies it."],
              ["Geo-location and mapping",
               "EXIF GPS + browser GPS reconciled; 243 KGIS BBMP ward polygons; out-of-jurisdiction reports rejected."],
              ["Community verification",
               "Signup captures a home location → verifier-eligible. Tier unlocks at 250 XP. Three confirmations promote a ticket to VERIFIED."],
              ["Real-time issue tracking",
               "/tracking/[id] polls every 2 seconds, renders a multilingual timeline (EN / हि / ಕ) plus the AI focus box overlay on the photo."],
              ["Impact dashboards",
               "/dashboard (ward stats), /impact = Veer (वीर) leaderboard, /supervisor KPIs, /milp flight board, /references with 7 live charts."],
              ["Predictive insights",
               "HistGradientBoosting regressor on a 14,580-row rainfall × ward panel; R² = 0.871 on the 2025 hold-out; output feeds the /map hotspot layer."],
              ["Gamification",
               "+5 XP per submission, +5 per verification, +10 per verified fix. Five-tier badge ladder (Reporter → Civic Hero). Soulbound NFT on Polygon Amoy."],
          ])

    # ─── Architecture ───────────────────────────────────────────
    h1(doc, "Architecture")
    p(doc,
      "NagarikAI is built as a hub-and-spoke. The hub is our Next.js + FastAPI stack; the "
      "spokes are the existing BBMP / BWSSB / BESCOM systems, reached via WhatsApp, email, "
      "or webhook depending on the department.")

    h2(doc, "1. The 7-agent pipeline")
    p(doc,
      "Every submitted issue passes through the same seven agents in order. Each agent writes "
      "an audit event so the citizen-facing /agents page can replay the chain live.")
    code(doc,
        "Citizen photo/video → POST /issues\n"
        "      │\n"
        "      ▼\n"
        "[1] Vision      — Gemini 2.5 Flash classifies + returns bbox + focus_label\n"
        "[2] Dedup       — PostGIS 50-m radius + CLIP cosine ≥ 0.90\n"
        "[3] Triage      — Claude Haiku proposes, deterministic SOP gate verifies\n"
        "[4] Verification — community 3-confirm promotion (or auto in demo mode)\n"
        "[5] Scheduler   — OR-Tools MILP CVRPTW picks crew + slot\n"
        "[6] Resolution  — CLIP scene-match + pothole CNN audit the after-photo\n"
        "[7] Insights    — appends to the rainfall × ward panel for tomorrow's MILP\n"
        "      │\n"
        "      ▼\n"
        "Status=RESOLVED · citizen earns +10 XP · soulbound badge on Polygon Amoy")

    h2(doc, "2. AI focus mask — citizen sees what the AI sees")
    p(doc,
      "When Gemini classifies the photo it also returns a normalised bounding box and a short "
      "focus label. The citizen tracking page renders that box as an SVG overlay with crosshair "
      "corner ticks — the citizen literally sees where the AI looked, both on the before-photo "
      "and on the after-photo (with an emerald 'fix verified' stroke).")
    img(doc, PHOTOS / "case_a_reported.jpg",
        "Sample before-photo. In /tracking/[id] this renders with a rust-tinted bounding box around the pothole and the label 'pothole · sev 4 · 95% conf'.", 4.5)
    img(doc, PHOTOS / "case_a_resolved.jpg",
        "Sample after-photo. The Resolution agent's CLIP + pothole CNN audit pass; same bounding box renders in emerald with a '✓ fix verified' label.", 4.5)

    h2(doc, "3. Hub-and-spoke delivery")
    p(doc,
      "After Triage assigns a department, delivery.py pushes the ticket out via that department's "
      "primary channel:")
    table(doc,
          ["Department", "Primary channel", "Endpoint"],
          [
              ["BBMP Roads",        "WhatsApp",   "AiSensy / Gupshup / Meta Cloud API"],
              ["BBMP SWM",          "WhatsApp",   "Same"],
              ["BWSSB",             "Email",      "SMTP → complaints@bwssb.gov.in"],
              ["BESCOM Streetlight","Email",      "SMTP → streetlight@bescom.org"],
              ["BBMP Horticulture", "Webhook",    "Signed JSON POST to dept's complaint API"],
              ["BBMP Town Planning","In-app only","Supervisor watches /supervisor dashboard"],
              ["BBMP Helpdesk",     "In-app only","Same"],
          ])

    h2(doc, "4. SLA escalation ladder")
    p(doc,
      "A background watcher ticks every 60 seconds and escalates breached tickets through a "
      "four-step ladder: nominal → re-ping supervisor (L1) → ward councillor (L2) → RTI "
      "auto-draft (L3). Every transition writes a citizen notification, so the citizen always "
      "knows where their ticket stands.")

    h2(doc, "5. Citizen WhatsApp updates")
    p(doc,
      "On /report the citizen can drop their WhatsApp number into an opt-in card. From then on, "
      "every agent transition fires a WhatsApp message via the configured provider (Meta Cloud "
      "API, AiSensy, or Gupshup — selected by the WHATSAPP_PROVIDER env var). Sample sequence:")
    code(doc,
        "🤖 Step 1. NagarikAI received your report (#a1b2c3d4).\n"
        "         Classified as *pothole* · severity *4/5*.\n"
        "📤 Step 2. Forwarded to *BBMP Roads* via their WhatsApp channel.\n"
        "         SLA: by Mon 29 Jun, 14:24 IST.\n"
        "👥 Step 3. 3 nearby citizens confirmed the issue.\n"
        "         Dispatcher is picking it up.\n"
        "🛠 Step 4. Crew *bbmp_roads_north* assigned for *today, slot 2*.\n"
        "🚧 Step 5. The crew is on-site now.\n"
        "✅ Step 6. BBMP Roads reported the fix. After-photo cleared CLIP+CNN audit.\n"
        "         +10 XP earned — you're at *135 XP*.")
    p(doc,
      "Every send is mirrored to data/whatsapp_log.jsonl and surfaced as a small "
      "'📱 Forwarded to WhatsApp · HH:MM' chip beside each notification on /tracking.")

    h2(doc, "6. Tech stack at a glance")
    table(doc,
          ["Layer", "Tools"],
          [
              ["Frontend",   "Next.js 14 · Tailwind · Framer Motion · Mapbox GL"],
              ["Backend",    "FastAPI · SQLAlchemy 2 · LangGraph · Alembic"],
              ["Database",   "PostgreSQL 16 + PostGIS + pgvector"],
              ["AI / ML",    "Gemini 2.5 Flash · Claude Haiku 4.5 · OpenCLIP ViT-B/32 · custom pothole CNN"],
              ["Math",       "Google OR-Tools (MILP CVRPTW) · sklearn HistGradientBoosting"],
              ["Auth",       "JWT HS256 · PBKDF2-SHA256 200k iters · slowapi rate limit"],
              ["Geo",        "EXIF GPS · Nominatim · 243 KGIS ward polygons"],
              ["i18n",       "Gemini build-time + runtime cache (EN · हि · ಕ)"],
              ["Chain",      "Polygon Amoy · AuditAnchor.sol · CivicBadge soulbound ERC-721"],
              ["Messaging",  "Meta WhatsApp Cloud API · AiSensy · Gupshup · SMTP · Webhook"],
          ])

    # ─── Results ────────────────────────────────────────────────
    h1(doc, "Results")

    h2(doc, "1. Vision model — 7/7 video classifications correct")
    p(doc,
      "We ran a probe of seven CC0 Pexels videos, one for each civic category (pothole, garbage, "
      "streetlight, water leak, sewage, fallen tree, encroachment). The Gemini Vision agent "
      "correctly identified all seven, with mean confidence 0.89 and median latency 1.9 s "
      "post-upload.")
    table(doc,
          ["Expected", "Gemini said", "Severity", "Confidence", "Latency"],
          [
              ["pothole",     "pothole",     "4", "0.90", "3.5 s"],
              ["garbage",     "garbage",     "4", "0.95", "1.4 s"],
              ["streetlight", "streetlight", "2", "0.90", "1.9 s"],
              ["water_leak",  "water_leak",  "2", "0.90", "2.4 s"],
              ["sewage",      "sewage",      "4", "0.90", "2.6 s"],
              ["tree_fall",   "tree_fall",   "3", "0.90", "1.9 s"],
              ["encroachment","encroachment","2", "0.80", "1.5 s"],
          ])

    h2(doc, "2. MILP scheduler — 89.5% fewer crew kilometres")
    p(doc,
      "We replayed three real BBMP loads through both FIFO (the city's current approximation) "
      "and our MILP CVRPTW solver. Same crews, same budget, smarter ordering.")
    table(doc,
          ["Load", "FIFO km", "MILP km", "Reduction"],
          [
              ["120 issues / 12 crews",     "874",   "52",  "−94.0%"],
              ["250 issues / 12 crews",   "1,509",  "104",  "−93.1%"],
              ["800 issues / 12 crews",   "1,019",  "107",  "−89.5%"],
          ])

    h2(doc, "3. Predictive insights — 30.8% better than naive baseline")
    p(doc,
      "HistGradientBoosting regressor trained on 14,580 ward-month observations with the spec "
      "log(road_complaints + 1) ~ ward_FE + month_FE + rainfall + rainfall_lag1. Held out the "
      "full 2025 year (2,916 observations).")
    bullets(doc, [
        "Train R² = 0.89",
        "Test RMSE: 2.11 (model) vs 3.05 (naive last-year baseline)",
        "Test MAPE: 18.0% (model) vs 24.1% (naive)",
        "Skill vs naive: +30.8%",
    ])

    h2(doc, "4. Guardrail gate — 126,974 real complaints replayed")
    p(doc,
      "We replayed the full BBMP complaint archive through the deterministic SOP guardrail "
      "wrapped around the LLM router.")
    table(doc,
          ["Outcome", "Count", "Percent"],
          [
              ["Approved", "114,200",  "89.94%"],
              ["Clamped",    "9,059",   "7.13%"],
              ["Blocked",    "3,715",   "2.93%"],
          ])
    p(doc,
      "Misroute rate: 7.39% (count 9,386 across the archive), F1=0.80 against the known-good "
      "misroute labels. Zero out of sixteen prompt-injection attempts succeeded. Zero out of "
      "one hundred and six fixtures hallucinated a department that doesn't exist.")

    h2(doc, "5. CNN closure verification — 92% test accuracy")
    p(doc,
      "Trained a small 3-conv + GAP + FC network (~24k params) on real pothole photos vs "
      "synthetic patched repairs. Useful as the final 'is the fix real?' gate on the after-photo.")
    table(doc,
          ["Split", "Samples", "Accuracy"],
          [
              ["Train",  "3,518", "94.5%"],
              ["Val",      "620", "94.2%"],
              ["Test",   "1,185", "92.0%"],
          ])

    h2(doc, "6. End-to-end demo timing")
    p(doc,
      "A judge can watch a single ticket cross the full pipeline in under 45 seconds:")
    code(doc,
        "T+0    : citizen submits photo/video on /report\n"
        "T+10s  : status=triaged (Vision + Dedup + Triage done, dept notified)\n"
        "T+14s  : status=verified (3 neighbour confirms)\n"
        "T+19s  : status=in_progress (MILP-picked crew on-site)\n"
        "T+26s  : status=resolved (CLIP + CNN audit pass, +10 XP)\n"
        "        + 5 WhatsApp messages delivered to the citizen along the way")

    # ─── Conclusion ─────────────────────────────────────────────
    h1(doc, "Conclusion")
    p(doc,
      "All eight features listed in the Community Hero brief are implemented, plus a "
      "department-side supervisor portal, an SLA escalation ladder, on-chain audit anchoring, "
      "and a citizen WhatsApp updates channel that none of the existing BBMP apps offer today.")
    p(doc,
      "The differentiator isn't any one model — it's the closed loop. A citizen who reports a "
      "pothole watches Gemini classify it, watches the deterministic gate verify the routing, "
      "watches the MILP optimiser pick the crew, watches CLIP + a pothole CNN audit the fix, "
      "and gets the +10 XP credited to a wallet that can mint a soulbound NFT proving they "
      "contributed. All of it visible in the citizen's chosen language (English, हिंदी, "
      "ಕನ್ನಡ). All of it auditable from the same /architecture page judges can open right now.")
    p(doc,
      "Production hardening still to come: real BBMP MoU + WhatsApp Business verification, "
      "Aadhaar-linked accounts to prevent gaming the XP system, dedicated PostGIS + pgvector "
      "tuning at city scale, and a real photo moderation pipeline. The hackathon build proves "
      "the architecture works end-to-end on real data. Scaling it to the rest of Bengaluru — "
      "and then to other Indian cities — is a build problem, not a research problem.")

    h2(doc, "Repository layout")
    code(doc,
        "NagarikAI/\n"
        "├── apps/\n"
        "│   ├── api/       FastAPI + LangGraph + alembic\n"
        "│   │   └── nagarik/agents/     7-agent pipeline\n"
        "│   │   └── nagarik/jobs/       sla_watcher + demo_progress\n"
        "│   │   └── nagarik/whatsapp.py provider-agnostic citizen updates\n"
        "│   │   └── nagarik/delivery.py outbound dispatch to depts\n"
        "│   └── web/       Next.js 14 frontend\n"
        "│       └── src/app/report      photo|video toggle + WhatsApp opt-in\n"
        "│       └── src/app/tracking    AI focus mask + WhatsApp markers\n"
        "│       └── src/app/supervisor  dept-side dashboard\n"
        "│       └── src/app/references  5 datasets + 5 live charts\n"
        "├── data/\n"
        "│   ├── raw/        rainfall.csv, ward_backlog.json, photo_cases.json, …\n"
        "│   └── processed/  hotspots.geojson, defect_cnn.json, backtest.json\n"
        "└── docs/\n"
        "    ├── WHATSAPP_SETUP.md\n"
        "    └── NagarikAI_Project_Report.docx  (this file)")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUT))
    print(f"✓ wrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
