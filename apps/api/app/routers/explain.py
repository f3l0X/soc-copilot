from fastapi import APIRouter, HTTPException

from app.db import DbSession
from app.models import Alert
from app.schemas.alerts import ExplainRequest, ExplainResponse
from app.services.explainer import explain
from app.services.llm import LLMError

router = APIRouter(prefix="/explain", tags=["alert-explainer"])


@router.post("", response_model=ExplainResponse)
def explain_alert(payload: ExplainRequest, db: DbSession) -> ExplainResponse:
    try:
        result = explain(payload.log, payload.source)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    alert = Alert(
        log=payload.log,
        source=payload.source,
        summary=result.summary,
        risk_level=result.risk_level,
        mitre_techniques=result.mitre_techniques,
        reasoning=result.reasoning,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    result.id = alert.id
    return result
