from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routers import alerts, auth, chat, explain, health, kb, llm, recommend, admin

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


# In production we hide Swagger/ReDoc + the OpenAPI schema. They leak the
# full API surface (auth flows, admin endpoints) and aren't needed by end
# users. Re-enable behind admin auth if/when needed.
_docs_url = None if settings.is_production else "/docs"
_redoc_url = None if settings.is_production else "/redoc"
_openapi_url = None if settings.is_production else "/openapi.json"

app = FastAPI(
    title="SOC Copilot API",
    description="AI Copilot for Junior SOC Analysts — Blue Team",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
)

# Credentialed CORS: never use "*", and enumerate allowed methods/headers
# explicitly. Browsers reject wildcards together with credentials anyway,
# but being explicit prevents a future config mistake from opening CSRF.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request, call_next):
    """Defense-in-depth headers applied to every API response."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
    )
    if settings.is_production:
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload",
        )
    return response

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(explain.router, prefix="/api")
app.include_router(recommend.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(kb.router, prefix="/api")
app.include_router(llm.router, prefix="/api")


@app.get("/")
def root():
    payload = {"name": "soc-copilot-api", "version": app.version}
    if _docs_url:
        payload["docs"] = _docs_url
    return payload
