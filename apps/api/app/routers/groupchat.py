"""Router: /api/groupchat — chat en grupo para todos los usuarios."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.db import DbSession
from app.middleware.auth import CurrentUser
from app.models import GroupMessage

router = APIRouter(prefix="/groupchat", tags=["groupchat"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class GroupMessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class GroupMessageOut(BaseModel):
    id: int
    user_id: int | None
    user_email: str
    user_name: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[GroupMessageOut])
def list_messages(
    db: DbSession,
    _user: CurrentUser,
    limit: int = Query(default=50, le=200),
    before_id: int | None = Query(default=None),
) -> list[GroupMessageOut]:
    """Devuelve los últimos mensajes del grupo, opcionalmente paginados."""
    q = select(GroupMessage).order_by(GroupMessage.created_at.desc()).limit(limit)
    if before_id is not None:
        q = q.where(GroupMessage.id < before_id)
    rows = db.execute(q).scalars().all()
    # Devolver en orden cronológico (más antiguo primero)
    return list(reversed(rows))


@router.post("", response_model=GroupMessageOut, status_code=201)
def send_message(
    payload: GroupMessageIn,
    user: CurrentUser,
    db: DbSession,
) -> GroupMessageOut:
    """Envía un mensaje al chat grupal."""
    full_name = " ".join(
        filter(None, [getattr(user, "name", ""), getattr(user, "last_name", "")])
    ) or user.email

    msg = GroupMessage(
        user_id=user.id,
        user_email=user.email,
        user_name=full_name,
        content=payload.content.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/poll", response_model=list[GroupMessageOut])
def poll_new_messages(
    db: DbSession,
    _user: CurrentUser,
    after_id: int = Query(...),
) -> list[GroupMessageOut]:
    """Polling ligero: devuelve mensajes con id > after_id."""
    rows = (
        db.execute(
            select(GroupMessage)
            .where(GroupMessage.id > after_id)
            .order_by(GroupMessage.created_at.asc())
            .limit(100)
        )
        .scalars()
        .all()
    )
    return list(rows)
