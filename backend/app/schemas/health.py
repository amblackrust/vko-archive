from typing import Literal

from pydantic import BaseModel

ComponentState = Literal["ok", "degraded", "unavailable"]


class ComponentStatus(BaseModel):
    status: ComponentState
    detail: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    db: ComponentStatus
    ollama: ComponentStatus
    embeddings: ComponentStatus
