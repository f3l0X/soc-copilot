from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routers import alerts, auth, chat, explain, health, kb, llm, recommend

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="SOC Copilot API",
    description="AI Copilot for Junior SOC Analysts — Blue Team",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(explain.router, prefix="/api")
app.include_router(recommend.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(kb.router, prefix="/api")
app.include_router(llm.router, prefix="/api")


@app.get("/")
def root():
    return {"name": "soc-copilot-api", "version": app.version, "docs": "/docs"}
