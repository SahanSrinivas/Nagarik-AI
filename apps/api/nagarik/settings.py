"""Centralized settings loaded from .env via pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["local", "staging", "prod"] = "local"
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://nagarik:nagarik@localhost:5432/nagarik"

    anthropic_api_key: str = ""
    google_api_key: str = ""
    openai_api_key: str = ""

    storage_provider: Literal["supabase", "s3"] = "supabase"
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_bucket: str = "civic-evidence"

    clerk_secret_key: str = ""
    jwt_public_key: str = ""

    osrm_url: str = "http://localhost:5050"

    cors_origins: str = "http://localhost:3000"

    # Public origin of the web app — embedded in outbound dept messages so the
    # supervisor-dashboard deep links work in WhatsApp / email previews.
    supervisor_base_url: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
