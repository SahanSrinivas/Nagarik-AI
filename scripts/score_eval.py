"""Phase 3 — score the Vision agent predictions.

Reads data/eval/predictions.jsonl, produces:
  * per-category accuracy + count
  * civic vs non-civic confusion (the *guardrail* table — most important)
  * full 8x8 confusion matrix (7 civic + other)
  * fetch / API / parse error rate
  * a sortable list of the worst misclassifications

Writes a human-readable report to data/eval/REPORT.md.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRED = ROOT / "data" / "eval" / "predictions.jsonl"
REPORT = ROOT / "data" / "eval" / "REPORT.md"

CIVIC = ["pothole", "garbage", "streetlight", "water_leak", "sewage", "tree_fall", "encroachment"]
ALL_LABELS = CIVIC + ["other"]


def main() -> None:
    if not PRED.exists():
        raise SystemExit(f"{PRED} not found — run scripts/run_eval.py first")

    rows = [json.loads(l) for l in PRED.read_text().splitlines() if l.strip()]
    print(f"Loaded {len(rows)} predictions\n")

    # Separate infrastructure errors (image fetch / Gemini API / parse failure)
    # from genuine model rejections — they are different operational signals.
    infra_errors = []
    valid = []
    for r in rows:
        reason = (r.get("pred_rejection_reason") or "")
        if reason.startswith(("image fetch", "gemini error", "parse")):
            infra_errors.append(r)
        else:
            valid.append(r)

    print(f"Infrastructure errors (excluded from accuracy): {len(infra_errors)}")
    print(f"Valid predictions: {len(valid)}\n")

    # Civic vs non-civic — THE guardrail table.
    # Treat any rejected prediction as "non-civic" from the model's POV.
    gt_civic, gt_noncivic = [], []
    for r in valid:
        (gt_civic if r["expected_civic"] else gt_noncivic).append(r)

    tp = sum(1 for r in gt_civic if not r.get("pred_rejected"))             # civic accepted as civic
    fn = sum(1 for r in gt_civic if r.get("pred_rejected"))                 # civic wrongly rejected
    tn = sum(1 for r in gt_noncivic if r.get("pred_rejected"))              # non-civic correctly rejected
    fp = sum(1 for r in gt_noncivic if not r.get("pred_rejected"))          # non-civic LEAKED through (worst case)

    sens = tp / max(1, tp + fn)
    spec = tn / max(1, tn + fp)
    fpr = fp / max(1, tn + fp)
    fnr = fn / max(1, tp + fn)

    # Per-category accuracy (civic-only)
    per_cat = defaultdict(lambda: {"n": 0, "correct": 0, "rejected": 0, "wrong_civic": 0})
    for r in gt_civic:
        cat = r["category"]
        per_cat[cat]["n"] += 1
        if r.get("pred_rejected"):
            per_cat[cat]["rejected"] += 1
        elif r.get("pred_type") == cat:
            per_cat[cat]["correct"] += 1
        else:
            per_cat[cat]["wrong_civic"] += 1

    # Full 8x8 confusion (rows = expected, cols = predicted)
    # For non-civic ground truth, "expected" is "other".
    conf = defaultdict(Counter)
    for r in valid:
        exp = r["category"] if r["expected_civic"] else "other"
        # Predicted: if rejected, treat as "other"; else use pred_type
        pred = "other" if r.get("pred_rejected") else r.get("pred_type", "other")
        conf[exp][pred] += 1

    # Worst leaks: non-civic photos that the model accepted as civic
    leaks = [r for r in gt_noncivic if not r.get("pred_rejected")]
    leaks.sort(key=lambda r: -r.get("pred_confidence", 0))

    # ── render REPORT.md
    lines: list[str] = []
    lines.append("# NagarikAI Vision agent — empirical eval\n")
    lines.append(f"Sample: **{len(valid)}** valid predictions "
                 f"(of {len(rows)} attempted; {len(infra_errors)} infra errors).")
    lines.append(f"Eval ran the live `vision_agent.PROMPT` against Gemini 2.5 Flash"
                 " and applied the same guardrail logic the production agent uses.\n")

    lines.append("## Guardrail — civic vs non-civic\n")
    lines.append("|              | predicted civic | predicted non-civic |")
    lines.append("|--------------|-----------------|---------------------|")
    lines.append(f"| **actual civic** ({len(gt_civic)}) | TP = **{tp}** | FN = **{fn}** |")
    lines.append(f"| **actual non-civic** ({len(gt_noncivic)}) | FP = **{fp}** | TN = **{tn}** |")
    lines.append("")
    lines.append(f"- **Sensitivity (civic recall)**: {sens:.1%}")
    lines.append(f"- **Specificity (non-civic correctly rejected)**: {spec:.1%}")
    lines.append(f"- **False-positive rate** (non-civic LEAKED to agent chain): {fpr:.1%}")
    lines.append(f"- **False-negative rate** (real civic issue wrongly rejected): {fnr:.1%}\n")

    lines.append("## Per-category accuracy (civic-only)\n")
    lines.append("| Category | n | exact match | wrong civic type | wrongly rejected |")
    lines.append("|---|---:|---:|---:|---:|")
    for cat in CIVIC:
        d = per_cat[cat]
        n = d["n"] or 1
        lines.append(f"| {cat} | {d['n']} | {d['correct']} ({d['correct']/n:.0%}) | {d['wrong_civic']} ({d['wrong_civic']/n:.0%}) | {d['rejected']} ({d['rejected']/n:.0%}) |")
    lines.append("")

    lines.append("## Confusion matrix (rows = expected, cols = predicted)\n")
    header = "| expected ↓ \\ pred → | " + " | ".join(ALL_LABELS) + " | total |"
    sep = "|---" * (len(ALL_LABELS) + 2) + "|"
    lines.append(header)
    lines.append(sep)
    for exp in ALL_LABELS:
        row = [exp]
        total = sum(conf[exp].values())
        for pred in ALL_LABELS:
            row.append(str(conf[exp].get(pred, 0)))
        row.append(str(total))
        lines.append("| " + " | ".join(row) + " |")
    lines.append("")

    if leaks:
        lines.append(f"## Non-civic leaks — model accepted non-civic photo as civic ({len(leaks)} cases)\n")
        lines.append("Top 10 by confidence (worst):\n")
        lines.append("| id | pred_type | confidence | url |")
        lines.append("|---|---|---:|---|")
        for r in leaks[:10]:
            lines.append(f"| {r['id']} | {r['pred_type']} | {r['pred_confidence']:.2f} | {r['url']} |")
        lines.append("")

    if infra_errors:
        lines.append(f"## Infrastructure errors ({len(infra_errors)})\n")
        breakdown = Counter()
        for r in infra_errors:
            kind = r.get("pred_rejection_reason", "").split(":")[0]
            breakdown[kind] += 1
        for kind, n in breakdown.most_common():
            lines.append(f"- {kind}: {n}")
        lines.append("")

    REPORT.write_text("\n".join(lines))

    # Also print a concise summary to stdout
    print("═" * 60)
    print(f"  Sensitivity (civic recall):       {sens:.1%}")
    print(f"  Specificity (non-civic rejected): {spec:.1%}")
    print(f"  FP-rate (non-civic LEAKED):       {fpr:.1%}  ← {fp} of {len(gt_noncivic)}")
    print(f"  FN-rate (real civic rejected):    {fnr:.1%}  ← {fn} of {len(gt_civic)}")
    print("═" * 60)
    print(f"\n✓ wrote {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
