from fastapi import APIRouter, HTTPException

from app.db import DbSession
from app.models import Alert, Recommendation
from app.schemas.alerts import RecommendRequest, RecommendResponse
from app.services.llm import LLMError
from app.services.recommender import recommend

router = APIRouter(prefix="/recommend", tags=["next-step-recommender"])


@router.post("", response_model=RecommendResponse)
def recommend_actions(payload: RecommendRequest, db: DbSession) -> RecommendResponse:
    alert: Alert | None = None
    log = payload.log
    source = payload.source
    explanation: str | None = None
    risk_level: str | None = None

    if payload.alert_id is not None:
        alert = db.get(Alert, payload.alert_id)
        if alert is None:
            raise HTTPException(
                status_code=404, detail=f"alert {payload.alert_id} not found"
            )
        log = alert.log
        source = alert.source
        explanation = alert.summary
        risk_level = alert.risk_level

    if not log or not log.strip():
        raise HTTPException(
            status_code=422,
            detail="provide either alert_id of an existing alert or non-empty log",
        )

    try:
        result = recommend(log, source, explanation, risk_level)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if alert is not None:
        rec = Recommendation(
            alert_id=alert.id,
            actions=[a.model_dump() for a in result.actions],
            priority=result.priority,
            learning_notes=result.learning_notes,
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        result.id = rec.id
        result.alert_id = alert.id

    return result
