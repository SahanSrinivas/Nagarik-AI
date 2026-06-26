"""Tiny path helper — finds the repo root (or any data file) regardless of
where the code lives in the tree.

Necessary because the same code runs from two layouts:
  - local dev:  /…/NagarikAI/apps/api/nagarik/…  (repo root = parents[4])
  - Cloud Run:  /app/nagarik/…                     (repo root = /app, parents[2])

Earlier files hard-coded ``parents[3]`` or ``parents[4]`` which works in
one environment and IndexError's in the other. Use the helpers below
instead so we don't have to chase this bug per-file.
"""

from __future__ import annotations

from pathlib import Path


def data_root() -> Path:
    """Return the directory containing ``data/processed/wards.geojson``.

    Walks up from this file looking for the sentinel; on Cloud Run
    that's ``/app/data``, locally it's the repo's ``data/``.
    Falls back to ``Path.cwd() / 'data'`` if nothing else matches.
    """
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        candidate = parent / "data" / "processed" / "wards.geojson"
        if candidate.exists():
            return candidate.parent.parent  # → .../data
    return Path.cwd() / "data"


def repo_root() -> Path:
    """Return the parent of ``data/``. Mainly for scripts that want
    to write next to the data tree (logs, generated files)."""
    return data_root().parent
