from pydantic import BaseModel, Field, field_validator


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
    summary: str
    risk_level: str
    mitre_techniques: list[str]
    reasoning: str


class RecommendRequest(BaseModel):
    log: str
    explanation: str | None = None


class RecommendAction(BaseModel):
    title: str
    detail: str
    rationale: str


class RecommendResponse(BaseModel):
    actions: list[RecommendAction]
    priority: str
    learning_notes: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    log_context: str | None = None


class ChatResponse(BaseModel):
    reply: str
    sources: list[str]
