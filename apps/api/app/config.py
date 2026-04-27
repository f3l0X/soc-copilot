from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-flash-lite"
    gemini_embed_model: str = "gemini-embedding-001"

    # Allowlist of chat models the frontend can switch to. Each must support
    # response_mime_type=application/json + response_schema (JSON mode) so
    # /api/explain and /api/recommend keep parsing structured output.
    # Comma-separated in env.
    gemini_chat_models_allowlist: str = (
        "gemini-2.5-flash-lite,gemini-2.5-flash,gemini-2.0-flash-lite"
    )

    @property
    def chat_models_list(self) -> list[str]:
        return [
            m.strip()
            for m in self.gemini_chat_models_allowlist.split(",")
            if m.strip()
        ]

    postgres_user: str = "soc"
    postgres_password: str = "change_me"
    postgres_db: str = "soc_copilot"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    chroma_host: str = "chroma"
    chroma_port: int = 8000

    api_cors_origins: str = "http://localhost:13000"

    rate_limit_enabled: bool = True
    rate_limit_requests: int = 20
    rate_limit_window_seconds: int = 60

    # ── Auth ────────────────────────────────────────────────────────────
    # Generate with: openssl rand -base64 48
    jwt_secret: str = "dev-only-change-me-32+chars-please"
    jwt_alg: str = "HS256"
    jwt_ttl_seconds: int = 3600  # 1h sessions
    cookie_name: str = "soc_session"
    cookie_secure: bool = False  # flip to true behind HTTPS / Caddy

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",") if o.strip()]

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
