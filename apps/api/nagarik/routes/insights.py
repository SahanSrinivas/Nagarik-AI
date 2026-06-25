"""Predictive insights — risk heatmap, top wards, leaderboard."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.models import Citizen, Issue, IssueStatus

router = APIRouter(prefix="/insights", tags=["insights"])

# apps/api/nagarik/routes/insights.py → parents[4] = repo root.
HOTSPOTS_PATH = Path(__file__).resolve().parents[4] / "data" / "processed" / "hotspots.geojson"


@router.get("/ward-stats")
def ward_stats(db: Session = Depends(get_db)) -> list[dict]:
    stmt = (
        select(
            Issue.ward,
            func.count(Issue.id).label("total"),
            func.count(Issue.id)
            .filter(Issue.status == IssueStatus.RESOLVED)
            .label("resolved"),
        )
        .where(Issue.ward.is_not(None))
        .group_by(Issue.ward)
        .order_by(desc("total"))
        .limit(20)
    )
    return [
        {"ward": r.ward, "total": r.total, "resolved": r.resolved}
        for r in db.execute(stmt).all()
    ]


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Citizen).order_by(Citizen.xp.desc()).limit(20)
    return [
        {"id": str(c.id), "name": c.name or "Anonymous", "xp": c.xp, "badge": c.badge}
        for c in db.scalars(stmt).all()
    ]


@router.get("/hotspot-prediction")
def hotspot_prediction(db: Session = Depends(get_db)) -> list[dict]:
    """Lightweight summary view — top N hotspots as records."""
    fc = _read_hotspots_geojson()
    return [
        {
            "lat": f["geometry"]["coordinates"][1],
            "lng": f["geometry"]["coordinates"][0],
            "risk": f["properties"].get("risk", 0.0),
            "type": f["properties"].get("type", "pothole"),
            "horizon_days": 30,
            "drivers": list((f["properties"].get("drivers") or {}).keys()),
        }
        for f in fc.get("features", [])
    ]


@router.get("/wards.geojson")
def wards_geojson() -> dict:
    """243 real KGIS Bengaluru ward polygons.

    Sourced from DataMeet `Municipal_Spatial_Data` via community-hero/data.
    File-served (~145KB); cache with ETag in production.
    """
    path = HOTSPOTS_PATH.parent / "wards.geojson"
    if not path.exists():
        return {"type": "FeatureCollection", "features": []}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"wards.geojson is malformed: {e}") from e


@router.get("/hotspots.geojson")
def hotspots_geojson() -> dict:
    """Raw GeoJSON FeatureCollection for the Mapbox heatmap layer.

    Produced by `notebooks/03_predictive_model.ipynb` → LightGBM risk model
    over a 250m grid of Bangalore. If the file isn't generated yet, return a
    minimal placeholder so the frontend renders nothing instead of erroring.
    """
    return _read_hotspots_geojson()


def _read_hotspots_geojson() -> dict:
    if not HOTSPOTS_PATH.exists():
        return {"type": "FeatureCollection", "features": []}
    try:
        return json.loads(HOTSPOTS_PATH.read_text())
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"hotspots.geojson is malformed: {e}") from e
