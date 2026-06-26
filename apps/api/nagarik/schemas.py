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
    routed_department: str | None
    sla_deadline: datetime | None
    duplicate_of_id: uuid.UUID | None
    ai_confidence: float
    resolved_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


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
