from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SmartGrade API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    frontend_origin: str = "http://localhost:3000"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    openai_api_key: str = ""
    openai_model: str = "gpt-6-luna"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
