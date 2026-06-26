"""Citizen-facing issue endpoints: create, list, get, and trigger the agent loop."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point
from sqlalchemy import select
from sqlalchemy.orm import Session

from nagarik.agents.graph import run_agent_loop
from nagarik.db import get_db
from nagarik.geo.resolver import resolve_from_url
from nagarik.models import AgentEvent, Citizen, Issue, IssueStatus
from nagarik.schemas import AgentEventRead, IssueCreate, IssueRead

router = APIRouter(prefix="/issues", tags=["issues"])


def _to_read(issue: Issue) -> IssueRead:
    pt = to_shape(issue.location)
    return IssueRead(
        id=issue.id,
        type=issue.type,
        severity=issue.severity,
        status=issue.status,
        lat=pt.y,
        lng=pt.x,
        address=issue.address,
        ward=issue.ward,
        description=issue.description,
        before_photo_url=issue.before_photo_url,
        after_photo_url=issue.after_photo_url,
        routed_department=issue.routed_department,
        sla_deadline=issue.sla_deadline,
        duplicate_of_id=issue.duplicate_of_id,
        ai_confidence=issue.ai_confidence,
        resolved_at=issue.resolved_at,
        created_at=issue.created_at,
    )


@router.post("", response_model=IssueRead, status_code=201)
def create_issue(
    payload: IssueCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
) -> IssueRead:
    # TODO: wire to real auth — for now, attach to a demo citizen.
    demo = db.scalar(select(Citizen).limit(1))
    if demo is None:
        demo = Citizen(phone="+910000000000", name="Demo Citizen")
        db.add(demo)
        db.flush()

    # Resolve location: extract EXIF GPS from the photo + reconcile with the
    # browser GPS the client submitted. Falls back to Nominatim geocoding of
    # the free-text address when no GPS sources available. Then
    # point-in-polygon for the ward. See nagarik/geo/resolver.py.
    resolved = resolve_from_url(
        payload.before_photo_url,
        browser_lat=payload.lat,
        browser_lng=payload.lng,
        address=payload.address,
    )
    final_lat = resolved.lat if resolved.lat is not None else payload.lat
    final_lng = resolved.lng if resolved.lng is not None else payload.lng
    final_ward = resolved.ward or None

    # BBMP-only gate: NagarikAI's jurisdiction is the 243 KGIS ward polygons
    # in data/processed/wards.geojson. We re-check the *final* coordinates
    # (which may differ from the raw browser GPS once EXIF / geocoder have
    # had their say) against the polygon set. Outside → reject with a clear
    # 422 so the citizen sees a useful error instead of a 500 on validation.
    if final_lat is None or final_lng is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "location_required",
                "message": "We couldn't determine the report's location. "
                           "Share your GPS or include a photo with EXIF location.",
            },
        )
    if final_ward is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "outside_bbmp_jurisdiction",
                "message": "This location is outside the BBMP (Bengaluru) "
                           "jurisdiction. NagarikAI only handles BBMP wards today.",
                "resolved": {
                    "lat": final_lat, "lng": final_lng,
                    "source": resolved.source,
                },
            },
        )

    issue = Issue(
        reporter_id=demo.id,
        type=payload.type or "other",
        severity=payload.severity,
        location=from_shape(Point(final_lng, final_lat), srid=4326),
        address=payload.address,
        ward=final_ward,
        description=payload.description,
        before_photo_url=payload.before_photo_url,
        ai_classification={
            "location_resolver": {
                "source": resolved.source,
                "ward": resolved.ward,
                "ward_no": resolved.ward_no,
                "exif_lat": resolved.exif_lat,
                "exif_lng": resolved.exif_lng,
                "browser_lat": resolved.browser_lat,
                "browser_lng": resolved.browser_lng,
                "cross_check_km": resolved.cross_check_km,
                "flagged_for_review": resolved.flagged_for_review,
                "geocoded_display": resolved.geocoded_display,
                "geocoder_confidence": resolved.geocoder_confidence,
            }
        },
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)

    # Fire the 7-agent loop asynchronously — UI polls /events to render the graph.
    bg.add_task(run_agent_loop, str(issue.id))

    return _to_read(issue)


@router.get("", response_model=list[IssueRead])
def list_issues(
    status: IssueStatus | None = None,
    ward: str | None = None,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
) -> list[IssueRead]:
    stmt = select(Issue).order_by(Issue.created_at.desc()).limit(limit)
    if status is not None:
        stmt = stmt.where(Issue.status == status)
    if ward is not None:
        stmt = stmt.where(Issue.ward == ward)
    return [_to_read(i) for i in db.scalars(stmt).all()]


@router.get("/nearby", response_model=list[IssueRead])
def nearby_issues(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(500, le=10000),
    db: Session = Depends(get_db),
) -> list[IssueRead]:
    # ST_DWithin on geography returns metres directly.
    pt = from_shape(Point(lng, lat), srid=4326)
    stmt = (
        select(Issue)
        .where(Issue.location.ST_DWithin(pt, radius_m))
        .order_by(Issue.created_at.desc())
        .limit(100)
    )
    return [_to_read(i) for i in db.scalars(stmt).all()]


@router.get("/{issue_id}", response_model=IssueRead)
def get_issue(issue_id: uuid.UUID, db: Session = Depends(get_db)) -> IssueRead:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")
    return _to_read(issue)


@router.get("/{issue_id}/events", response_model=list[AgentEventRead])
def issue_events(issue_id: uuid.UUID, db: Session = Depends(get_db)) -> list[AgentEventRead]:
    stmt = (
        select(AgentEvent)
        .where(AgentEvent.issue_id == issue_id)
        .order_by(AgentEvent.created_at.asc())
    )
    return [AgentEventRead.model_validate(e) for e in db.scalars(stmt).all()]
