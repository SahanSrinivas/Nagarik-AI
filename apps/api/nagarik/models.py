"""ORM models — Postgres with PostGIS Point and pgvector Embedding.

Keep schema deliberately small; expand only when the agent loop needs new fields.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from geoalchemy2 import Geography
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nagarik.db import Base

# pgvector is optional — fall back to JSON-stored list of floats when not
# available. The DedupAgent reads either form via a unified helper.
try:
    from pgvector.sqlalchemy import Vector as _Vector  # type: ignore
    EmbeddingType = _Vector(512)
except ImportError:
    EmbeddingType = JSON


class IssueType(str, Enum):
    POTHOLE = "pothole"
    GARBAGE = "garbage"
    STREETLIGHT = "streetlight"
    WATER_LEAK = "water_leak"
    SEWAGE = "sewage"
    TREE_FALL = "tree_fall"
    ENCROACHMENT = "encroachment"
    OTHER = "other"


class IssueStatus(str, Enum):
    REPORTED = "reported"        # citizen just submitted
    CLASSIFIED = "classified"    # VisionAgent finished
    DEDUPED = "deduped"          # DedupAgent finished
    TRIAGED = "triaged"          # routed to dept
    VERIFIED = "verified"        # 3+ community confirmations
    SCHEDULED = "scheduled"      # crew assigned by MILP
    IN_PROGRESS = "in_progress"  # crew on-site
    RESOLVED = "resolved"        # after-photo verified
    CLOSED = "closed"
    REJECTED = "rejected"        # invalid/spam


class Citizen(Base):
    __tablename__ = "citizens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(15), unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(60), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(200))
    name: Mapped[str | None] = mapped_column(String(80))
    xp: Mapped[int] = mapped_column(default=0)          # gamification
    badge: Mapped[str | None] = mapped_column(String(40))
    ward: Mapped[str | None] = mapped_column(String(40))

    # Optional home location captured at signup. When present we flip
    # is_verifier=True so the citizen can confirm/contest reports inside
    # a ~500m radius of where they live — same trust mechanism Waze uses.
    home_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_verifier: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    issues: Mapped[list[Issue]] = relationship(back_populates="reporter")


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizens.id"), index=True)
    type: Mapped[IssueType] = mapped_column(String(20), default=IssueType.OTHER)
    severity: Mapped[int] = mapped_column(default=3)    # 1-5 scale
    status: Mapped[IssueStatus] = mapped_column(String(20), default=IssueStatus.REPORTED, index=True)

    # Point in WGS84 — distance queries use ::geography to get metres.
    location: Mapped[Geography] = mapped_column(Geography(geometry_type="POINT", srid=4326))
    address: Mapped[str | None] = mapped_column(String(300))
    ward: Mapped[str | None] = mapped_column(String(40), index=True)

    description: Mapped[str] = mapped_column(Text, default="")
    before_photo_url: Mapped[str | None] = mapped_column(String(500))
    after_photo_url: Mapped[str | None] = mapped_column(String(500))
    # Short video clip (≤30s) supplied as an alternative or supplement to
    # the photo. Vision agent uses Gemini 2.5 Flash Files API to extract
    # the same classification JSON from frames.
    before_video_url: Mapped[str | None] = mapped_column(String(500))
    after_video_url: Mapped[str | None] = mapped_column(String(500))

    # Filled in by VisionAgent.
    ai_classification: Mapped[dict] = mapped_column(JSON, default=dict)
    ai_confidence: Mapped[float] = mapped_column(Float, default=0.0)

    # Filled in by DedupAgent — CLIP image embedding for similarity search.
    image_embedding: Mapped[list[float] | None] = mapped_column(EmbeddingType, nullable=True)
    duplicate_of_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("issues.id"), nullable=True
    )

    # Filled in by TriageAgent.
    routed_department: Mapped[str | None] = mapped_column(String(80))
    sla_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Filled in by SchedulerAgent (MILP).
    assigned_crew_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("crews.id"))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Department workflow — when we dispatched to the dept's external channel,
    # whether they acknowledged, and which escalation level we've reached.
    # delivered_channel ∈ {whatsapp, email, webhook, inapp_only}
    # escalation_level: 0 = nominal, 1 = dept-head, 2 = councillor, 3 = RTI auto-draft
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_channel: Mapped[str | None] = mapped_column(String(20))
    acked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)
    escalated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Optional WhatsApp opt-in captured on /report. If set, every status
    # transition for this issue also fires a WhatsApp template to the
    # number via nagarik.whatsapp.send_citizen_update().
    whatsapp_number: Mapped[str | None] = mapped_column(String(20))

    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    reporter: Mapped[Citizen] = relationship(back_populates="issues")
    verifications: Mapped[list[Verification]] = relationship(back_populates="issue")
    events: Mapped[list[AgentEvent]] = relationship(back_populates="issue")

    __table_args__ = (
        # GIST index for fast nearest-neighbor queries.
        Index("ix_issues_location", "location", postgresql_using="gist"),
        # IVFFlat for embedding similarity is created at first query time
        # by the DedupAgent — only when pgvector is actually installed.
    )


class Verification(Base):
    __tablename__ = "verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("issues.id"), index=True)
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizens.id"), index=True)
    confirms: Mapped[bool] = mapped_column(default=True)
    note: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    issue: Mapped[Issue] = relationship(back_populates="verifications")


class Crew(Base):
    __tablename__ = "crews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(80))
    department: Mapped[str] = mapped_column(String(80), index=True)  # BBMP, BWSSB, BESCOM
    depot_location: Mapped[Geography] = mapped_column(Geography(geometry_type="POINT", srid=4326))
    skills: Mapped[list] = mapped_column(JSON, default=list)  # e.g. ["pothole","streetlight"]
    daily_capacity: Mapped[int] = mapped_column(default=8)    # max issues per day
    shift_start_hour: Mapped[int] = mapped_column(default=9)
    shift_end_hour: Mapped[int] = mapped_column(default=18)
    is_active: Mapped[bool] = mapped_column(default=True)


class Department(Base):
    """The 7 BBMP/BWSSB/BESCOM departments NagarikAI dispatches tickets to.

    Seeded from agents/guardrails.py SOP_TABLE by scripts/seed_departments.py.
    primary_channel decides how delivery.py routes new tickets — whatsapp →
    AiSensy/Gupshup, email → SMTP, webhook → signed POST, inapp_only → no-op
    (the dept logs in via /dept-login and watches their queue instead).
    """

    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)        # e.g. "BBMP_ROADS"
    name: Mapped[str] = mapped_column(String(80), unique=True)                    # "BBMP Roads"
    primary_channel: Mapped[str] = mapped_column(String(20), default="inapp_only")
    whatsapp_number: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(120))
    webhook_url: Mapped[str | None] = mapped_column(String(300))
    supervisor_name: Mapped[str | None] = mapped_column(String(80))
    supervisor_phone: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class DepartmentUser(Base):
    """Login record for a department supervisor or crew lead.

    role ∈ {supervisor, crew_lead}. JWT issued by /auth/dept-login carries
    role + department_id claims so /supervisor and /crew routes can gate by
    both authentication AND department.
    """

    __tablename__ = "department_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id"), index=True)
    role: Mapped[str] = mapped_column(String(20), default="supervisor")
    name: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentEvent(Base):
    """Audit trail of every agent step — powers the live-graph visualizer."""

    __tablename__ = "agent_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("issues.id"), index=True)
    agent: Mapped[str] = mapped_column(String(40))              # "vision", "dedup", ...
    status: Mapped[str] = mapped_column(String(20))             # "started", "completed", "failed"
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    duration_ms: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    issue: Mapped[Issue] = relationship(back_populates="events")
