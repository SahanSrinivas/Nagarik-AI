"""Pydantic schemas for request/response payloads."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from nagarik.models import IssueStatus, IssueType


class IssueCreate(BaseModel):
    type: IssueType | None = None        # if None, VisionAgent fills it in
    severity: int = Field(default=3, ge=1, le=5)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address: str | None = None
    description: str = ""
    before_photo_url: str | None = None  # client uploads to Supabase, then sends URL
    before_video_url: str | None = None  # short clip — Gemini Files API
    before_audio_url: str | None = None  # voice note (Kannada / Hindi / EN) — Gemini multimodal
    whatsapp_number: str | None = Field(default=None, max_length=20)  # optional WhatsApp opt-in


class IssueRead(BaseModel):
    id: uuid.UUID
    type: IssueType
    severity: int
    status: IssueStatus
    lat: float
    lng: float
    address: str | None
    ward: str | None
    description: str
    before_photo_url: str | None
    after_photo_url: str | None
    before_video_url: str | None = None
    after_video_url: str | None = None
    before_audio_url: str | None = None
    routed_department: str | None
    sla_deadline: datetime | None
    duplicate_of_id: uuid.UUID | None
    ai_confidence: float
    # AI budget estimator (Vision Agent V2 upgrade)
    estimated_materials: list[dict] = []
    estimated_cost_inr: int | None = None
    # Viral before/after share asset (populated post-resolution)
    share_image_url: str | None = None
    # Community DIY ladder
    diy_unlocked_at: datetime | None = None
    diy_threshold_met_at: datetime | None = None
    resolved_at: datetime | None
    delivered_at: datetime | None = None
    delivered_channel: str | None = None
    acked_at: datetime | None = None
    escalation_level: int = 0
    escalated_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PledgeCreate(BaseModel):
    kind: str = Field(pattern="^(funds|hours)$")
    amount_inr: int | None = Field(default=None, ge=10, le=100000)
    hours: float | None = Field(default=None, gt=0, le=24)
    note: str | None = Field(default=None, max_length=200)


class PledgeRead(BaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    citizen_id: uuid.UUID
    kind: str
    amount_inr: int | None
    hours: float | None
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DiyState(BaseModel):
    """Read-side projection of an issue's community-DIY status."""
    unlocked: bool
    unlocked_at: datetime | None
    threshold_met: bool
    threshold_met_at: datetime | None
    funds_total_inr: int
    hours_total: float
    pledges: list[PledgeRead]
    schedule: dict


class VerificationCreate(BaseModel):
    confirms: bool = True
    note: str | None = None


class AgentEventRead(BaseModel):
    agent: str
    status: str
    payload: dict
    duration_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScheduleRequest(BaseModel):
    date: str                            # YYYY-MM-DD — solve for this day
    ward: str | None = None              # optional ward filter
    max_crews: int | None = None         # cap problem size


class ScheduleResponse(BaseModel):
    solver_status: str
    runtime_seconds: float
    routes: list[dict]                   # [{crew_id, crew_name, depot:{lat,lng}, stops:[{issue_id,lat,lng,type,severity}], total_km, total_time_min}]
    metrics: dict                        # {weighted_lateness, total_km, served, unserved}
