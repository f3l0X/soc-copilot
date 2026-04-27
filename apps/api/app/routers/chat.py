import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.middleware.auth import CurrentUser
from app.middleware.ratelimit import rate_limit
from app.schemas.alerts import ChatRequest, ChatResponse
from app.services.chat import chat as chat_service
from app.services.llm import LLMProviderError, LLMResponseError

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/chat", tags=["chat-ia"], dependencies=[Depends(rate_limit)]
)


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, _user: CurrentUser) -> ChatResponse:
    # _user is unused inside the body — its sole purpose is to gate access
    # via the auth dependency. FastAPI still resolves it.
    try:
        return chat_service(
            payload.messages, payload.log_context, model=payload.model
        )
    except LLMProviderError:
        logger.exception("LLM provider error in /chat")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI provider error"
        ) from None
    except LLMResponseError:
        logger.exception("LLM response could not be processed in /chat")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI response could not be processed",
        ) from None
