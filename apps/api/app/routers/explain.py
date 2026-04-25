from fastapi import APIRouter, HTTPException

from app.schemas.alerts import ExplainRequest, ExplainResponse
from app.services.explainer import explain
from app.services.llm import LLMError

router = APIRouter(prefix="/explain", tags=["alert-explainer"])


@router.post("", response_model=ExplainResponse)
def explain_alert(payload: ExplainRequest) -> ExplainResponse:
    try:
        return explain(payload.log, payload.source)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
