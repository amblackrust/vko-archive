from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "development"
    database_url: str
    test_database_url: str | None = None
    cors_origins: list[str] = ["http://localhost:3000"]

    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3.5:9b-q6k"
    ollama_embed_model: str = "bge-m3"
    ollama_timeout_seconds: float = 5.0
    # The first embed call may load bge-m3 into memory (several seconds).
    ollama_embed_timeout_seconds: float = 30.0

    storage_dir: Path = BACKEND_DIR / "storage"


@lru_cache
def get_settings() -> Settings:
    return Settings()
