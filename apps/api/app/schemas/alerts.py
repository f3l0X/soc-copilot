from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ─── Alert Explainer ────────────────────────────────────────────────────────


class ExplainRequest(BaseModel):
    log: str = Field(
        ...,
        min_length=1,
        max_length=20_000,
        description="Raw log line or alert payload to analyze",
    )
    source: str | None = Field(
        None,
        max_length=200,
        description="Origin (e.g. nginx, auth, syslog)",
    )

    @field_validator("log")
    @classmethod
    def _log_must_have_content(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("log must contain non-whitespace characters")
        return v


class ExplainResponse(BaseModel):
    id: int | None = None  # populated after persistence
    summary: str
    risk_level: str
    mitre_techniques: list[str]
    reasoning: str


# ─── Next Step Recommender ──────────────────────────────────────────────────


class RecommendRequest(BaseModel):
    """Either alert_id (use stored explanation) or raw log+source."""

    alert_id: int | None = None
    log: str | None = Field(None, max_length=20_000)
    source: str | None = Field(None, max_length=200)


class RecommendAction(BaseModel):
    title: str
    detail: str
    rationale: str


class RecommendResponse(BaseModel):
    id: int | None = None
    alert_id: int | None = None
    actions: list[RecommendAction]
    priority: str
    learning_notes: str


# ─── Alert history (DB views) ───────────────────────────────────────────────


class AlertSummary(BaseModel):
    """Compact view for list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str | None
    summary: str | None
    risk_level: str | None
    mitre_techniques: list[str] | None
    created_at: datetime


class AlertDetail(AlertSummary):
    log: str
    reasoning: str | None
    recommendations: list[RecommendationDetail] = []


class RecommendationDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actions: list[RecommendAction]
    priority: str
    learning_notes: str | None
    created_at: datetime


AlertDetail.model_rebuild()


# ─── Chat (kept for Phase 3) ────────────────────────────────────────────────


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    log_context: str | None = None


class ChatResponse(BaseModel):
    reply: str
    sources: list[str]
