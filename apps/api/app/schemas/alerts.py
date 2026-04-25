from pydantic import BaseModel, Field


class ExplainRequest(BaseModel):
    log: str = Field(..., description="Raw log line or alert payload to analyze")
    source: str | None = Field(None, description="Origin (e.g. nginx, auth, syslog)")


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
