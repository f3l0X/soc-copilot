from fastapi import APIRouter

from app.schemas.alerts import RecommendRequest, RecommendResponse

router = APIRouter(prefix="/recommend", tags=["next-step-recommender"])


@router.post("", response_model=RecommendResponse)
def recommend_actions(payload: RecommendRequest) -> RecommendResponse:
    return RecommendResponse(
        actions=[],
        priority="unknown",
        learning_notes="Phase 2 will implement recommendation logic.",
    )
