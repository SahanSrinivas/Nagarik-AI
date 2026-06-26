"""Probe Gemini 2.5 Flash on 7 real civic-issue video clips.

For each clip we:
  1. Stream-download to /tmp.
  2. Upload to the Gemini Files API.
  3. Poll until ACTIVE.
  4. Send the same JSON-mode prompt the VisionAgent uses in production.
  5. Record what Gemini returned (type, severity, hazard, notes).

The output is written to ``data/processed/gemini_video_probes.json`` and
printed as a markdown table. We run this once and cache so the references
page can cite real Gemini outputs — not hand-written examples.

Usage:
    GOOGLE_API_KEY=... PYTHONPATH=. python -m scripts.probe_gemini_videos
"""

from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path

import httpx

# 7 categories the SOP table routes — every one has a known department.
# Sources: Pexels CDN, License = Pexels (free for commercial use).
TEST_VIDEOS: list[dict[str, str]] = [
    {
        "category": "pothole",
        "title":    "Traffic Navigating Pothole on Busy Street",
        "url":      "https://videos.pexels.com/video-files/34218230/14505599_1920_1080_25fps.mp4",
        "credit":   "Christian Bardot · Pexels",
    },
    {
        "category": "garbage",
        "title":    "Large Pile of Garbage in Outdoor Dump Site",
        "url":      "https://videos.pexels.com/video-files/28827625/12487566_1920_1080_30fps.mp4",
        "credit":   "Pexels (uncredited)",
    },
    {
        "category": "streetlight",
        "title":    "Sparks from Damaged Streetlamp at Night",
        "url":      "https://videos.pexels.com/video-files/33942941/14403294_3840_2160_25fps.mp4",
        "credit":   "Pexels (uncredited)",
    },
    {
        "category": "water_leak",
        "title":    "Water Dripping on Welded Metal Pipes",
        "url":      "https://videos.pexels.com/video-files/5571839/5571839-hd_1920_1080_24fps.mp4",
        "credit":   "Pexels (uncredited)",
    },
    {
        "category": "sewage",
        "title":    "Sewer Pipes Releasing Water in the River",
        "url":      "https://videos.pexels.com/video-files/5535467/5535467-uhd_3840_2160_30fps.mp4",
        "credit":   "Pexels (uncredited)",
    },
    {
        "category": "tree_fall",
        "title":    "Fallen Tree Trunk Over a Creek",
        "url":      "https://videos.pexels.com/video-files/5764717/5764717-uhd_3840_2160_30fps.mp4",
        "credit":   "Pexels (uncredited)",
    },
    {
        "category": "encroachment",
        "title":    "Busy Street Market Scene with Vendor and Traffic",
        "url":      "https://videos.pexels.com/video-files/36976482/15665030_3840_2160_60fps.mp4",
        "credit":   "Pexels (uncredited)",
    },
]

PROMPT = """You are a civic-issue triage assistant for an Indian municipality (BBMP, BWSSB, BESCOM).

Look at the video and return STRICT JSON only — no prose, no markdown.

Schema:
{
  "type":       one of [pothole, garbage, streetlight, water_leak, sewage, tree_fall, encroachment, other],
  "severity":   integer 1-5 (5 = immediate hazard to life or property),
  "confidence": float 0-1,
  "notes":      one short sentence for the field crew (max 25 words),
  "width_m":    approximate width in metres (or null),
  "depth_cm":   approximate depth in cm if applicable (or null),
  "indoor":     true if the video is clearly indoor / not a civic issue,
  "hazard_to":  one of [pedestrians, vehicles, residents, sanitation, public_safety, none]
}

Only return the JSON object. No text before or after."""


def probe_one(client, item: dict[str, str]) -> dict:
    from google.genai import types as gtypes

    print(f"\n→ {item['category']:14s} | {item['title']}")
    # 1. download
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        local_path = f.name
    t0 = time.time()
    with httpx.Client(follow_redirects=True, timeout=120) as http:
        with http.stream("GET", item["url"]) as r:
            r.raise_for_status()
            with open(local_path, "wb") as fp:
                for chunk in r.iter_bytes(1024 * 256):
                    fp.write(chunk)
    size_mb = Path(local_path).stat().st_size / (1024 * 1024)
    print(f"   downloaded {size_mb:.1f}MB in {time.time() - t0:.1f}s")

    # 2. upload to Files API
    t0 = time.time()
    uploaded = client.files.upload(file=local_path, config={"mime_type": "video/mp4"})
    print(f"   uploaded as {uploaded.name}")

    # 3. poll until ACTIVE
    for attempt in range(60):
        info = client.files.get(name=uploaded.name)
        state = getattr(info, "state", None)
        state_name = state.name if hasattr(state, "name") else str(state)
        if state_name == "ACTIVE":
            print(f"   ACTIVE after {time.time() - t0:.1f}s, {attempt + 1} polls")
            break
        if state_name == "FAILED":
            return {**item, "error": "Gemini reported FAILED"}
        time.sleep(2)
    else:
        return {**item, "error": "did not become ACTIVE within 120s"}

    # 4. classify
    t0 = time.time()
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                gtypes.Part.from_uri(file_uri=info.uri, mime_type="video/mp4"),
                PROMPT,
            ],
            config=gtypes.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
                thinking_config=gtypes.ThinkingConfig(thinking_budget=0),
                max_output_tokens=800,
            ),
        )
        raw = getattr(resp, "text", "") or ""
        gemini_ms = int((time.time() - t0) * 1000)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"_raw": raw[:300], "_parse_error": True}
        print(f"   gemini → type={parsed.get('type'):12s} severity={parsed.get('severity')} "
              f"conf={parsed.get('confidence')} ({gemini_ms}ms)")
    finally:
        try:
            client.files.delete(name=uploaded.name)
        except Exception:  # noqa: BLE001
            pass
        try:
            Path(local_path).unlink()
        except OSError:
            pass

    return {
        **item,
        "size_mb": round(size_mb, 1),
        "gemini_ms": gemini_ms,
        "gemini": parsed,
        "expected_type": item["category"],
        "type_match": parsed.get("type") == item["category"],
    }


def main() -> None:
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("CH_GOOGLE_API_KEY")
    if not api_key:
        raise SystemExit("GOOGLE_API_KEY env var is required")

    from google import genai
    client = genai.Client(api_key=api_key)

    results = []
    for item in TEST_VIDEOS:
        try:
            results.append(probe_one(client, item))
        except Exception as exc:  # noqa: BLE001 — record and keep going
            print(f"   FAILED: {exc.__class__.__name__}: {exc}")
            results.append({**item, "error": f"{exc.__class__.__name__}: {exc}"})

    # apps/api/scripts/<this>.py → repo root is parents[3]
    out_path = Path(__file__).resolve().parents[3] / "data" / "processed" / "gemini_video_probes.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({
        "model": "gemini-2.5-flash",
        "prompt_version": "1.0",
        "results": results,
    }, indent=2))

    # Print summary table
    print("\n" + "=" * 80)
    print(f"{'category':14s} {'expected':14s} {'gemini':14s} {'match':6s} {'severity':9s} {'ms':6s}")
    print("-" * 80)
    matches = 0
    for r in results:
        if "error" in r:
            print(f"{r['category']:14s} {'—':14s} ERROR  {r['error'][:40]}")
            continue
        ok = "✓" if r["type_match"] else "✗"
        matches += int(r["type_match"])
        gtype = r.get("gemini", {}).get("type", "?")
        sev = r.get("gemini", {}).get("severity", "?")
        ms = r.get("gemini_ms", 0)
        print(f"{r['category']:14s} {r['expected_type']:14s} {gtype:14s} {ok:6s} {sev!s:9s} {ms:6d}")
    print("=" * 80)
    print(f"Type-match: {matches}/{len(results)}")
    print(f"\nResults written to: {out_path}")


if __name__ == "__main__":
    main()
