from fastapi import APIRouter

from app.schemas.alerts import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat-ia"])


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    return ChatResponse(
        reply="(stub) chat module not implemented yet",
        sources=[],
    )
