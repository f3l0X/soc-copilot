from fastapi import APIRouter

from app.schemas.alerts import ExplainRequest, ExplainResponse

router = APIRouter(prefix="/explain", tags=["alert-explainer"])


@router.post("", response_model=ExplainResponse)
def explain_alert(payload: ExplainRequest) -> ExplainResponse:
    return ExplainResponse(
        summary="(stub) module not implemented yet",
        risk_level="unknown",
        mitre_techniques=[],
        reasoning="Phase 1 will implement Gemini-backed explanation.",
    )
