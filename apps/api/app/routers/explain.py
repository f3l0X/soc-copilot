import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from app.db import DbSession
from app.middleware.auth import CurrentUser
from app.middleware.ratelimit import rate_limit
from app.models import Alert
from app.schemas.alerts import ExplainRequest, ExplainResponse
from app.services.explainer import explain
from app.services.llm import LLMProviderError, LLMResponseError

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/explain", tags=["alert-explainer"], dependencies=[Depends(rate_limit)]
)


@router.post("", response_model=ExplainResponse)
def explain_alert(
    payload: ExplainRequest, db: DbSession, user: CurrentUser
) -> ExplainResponse:
    try:
        result = explain(
            payload.log, payload.source, model=payload.model, user=user, db=db
        )
    except LLMProviderError:
        logger.exception("LLM provider error in /explain")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI provider error"
        ) from None
    except (LLMResponseError, ValidationError):
        logger.exception("LLM response could not be processed in /explain")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI response could not be processed",
        ) from None

    alert = Alert(
        log=payload.log,
        source=payload.source,
        summary=result.summary,
        risk_level=result.risk_level,
        mitre_techniques=result.mitre_techniques,
        reasoning=result.reasoning,
        user_id=user.id,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    result.id = alert.id
    return result
