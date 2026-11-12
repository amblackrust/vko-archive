from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator
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
    ollama_model: str = "qwen3.5:9b-q4_K_M"
    ollama_embed_model: str = "bge-m3"
    # Used when OLLAMA_MODEL is not pulled (qwen3.5:9b-q4_K_M).
    ollama_fallback_model: str = "qwen3.5:9b-q4_K_M"
    # Connect / model-list timeout; chat generation has its own (the first call loads the model, ~30 s).
    ollama_timeout_seconds: float = 5.0
    ollama_chat_timeout_seconds: float = 120.0
    ollama_parser_timeout_seconds: float = 60.0
    ollama_num_ctx: int = 8192
    # Generation limits (DoS): tokens per answer, simultaneous generations per process
    # (more → fast «busy» refusal), requests per IP per minute to /api/ai/parse and /answer*.
    ollama_num_predict: int = 400
    ai_max_concurrent_generations: int = 4
    # OCR fallback when Tesseract is not installed: a vision model of Ollama (empty = none).
    ollama_vision_model: str = ""
    # Staff tools (analysis JSON, report) answer longer than the public chat.
    ollama_staff_num_predict: int = 1200
    ai_rate_limit_per_minute: int = 10
    # The first embed call may load bge-m3 into memory (several seconds).
    ollama_embed_timeout_seconds: float = 30.0
    # /api/health is public: its Ollama probes are short and their result is cached.
    health_probe_timeout_seconds: float = 3.0
    health_cache_ttl_seconds: float = 60.0

    storage_dir: Path = BACKEND_DIR / "storage"

    # Admin sessions (T6.1). The key comes only from the environment; without it login fails.
    jwt_secret: SecretStr | None = None
    session_cookie_secure: bool = True
    session_idle_minutes: int = 30
    session_max_hours: int = 12
    login_max_attempts: int = 5
    login_lock_minutes: int = 15

    # OAuth client id for «Sign in with Google» in the cabinet. Empty = the button is not shown.
    google_client_id: str = ""

    # Public origin of the site, the base of links in e-mails (reset / confirmation).
    frontend_url: str = "http://localhost:3000"
    # Outgoing mail (STARTTLS). Without smtp_host nothing is sent and nothing fails.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: SecretStr | None = None
    smtp_from: str = ""
    smtp_timeout_seconds: float = 10.0

    @field_validator("cors_origins")
    @classmethod
    def _check_cors_origins(cls, value: list[str]) -> list[str]:
        # Credentials are allowed, so a wildcard would let any site call the API as the
        # signed-in user (Starlette echoes the request origin for "*" with credentials).
        if any(origin == "*" or not origin.startswith(("http://", "https://")) for origin in value):
            raise ValueError("CORS_ORIGINS must list exact frontend origins (no wildcard)")
        return [origin.rstrip("/") for origin in value]

    @field_validator("jwt_secret")
    @classmethod
    def _check_jwt_secret(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None:
            return None
        secret = value.get_secret_value()
        if secret.startswith("change_me") or len(secret) < 32:
            raise ValueError("JWT_SECRET must be a random value of at least 32 characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
