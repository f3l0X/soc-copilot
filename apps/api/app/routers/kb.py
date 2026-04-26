import logging

from fastapi import APIRouter, HTTPException, status

from app.services.llm import LLMProviderError
from app.services.rag import kb_status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/kb", tags=["knowledge-base"])


@router.get("/status")
def get_status() -> dict[str, int | str]:
    try:
        return kb_status()
    except LLMProviderError:
        logger.exception("KB status check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="knowledge base unreachable",
        ) from None
