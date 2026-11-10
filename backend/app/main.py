from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.logging_config import configure_logging, log_requests
from app.routers import admin
from app.routers.public import (
    ai,
    branches,
    cabinet,
    catalog,
    content,
    exhibitions,
    files,
    health,
    home,
    legal,
    memory,
    news,
    search,
)
from app.services.errors import (
    AccountLocked,
    Conflict,
    CsrfFailed,
    InvalidCredentials,
    InvalidInput,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    RateLimited,
    ServiceError,
)

_ERROR_STATUS: dict[type[ServiceError], int] = {
    NotAuthenticated: status.HTTP_401_UNAUTHORIZED,
    InvalidCredentials: status.HTTP_401_UNAUTHORIZED,
    AccountLocked: status.HTTP_429_TOO_MANY_REQUESTS,
    RateLimited: status.HTTP_429_TOO_MANY_REQUESTS,
    CsrfFailed: status.HTTP_403_FORBIDDEN,
    PermissionDenied: status.HTTP_403_FORBIDDEN,
    NotFound: status.HTTP_404_NOT_FOUND,
    Conflict: status.HTTP_409_CONFLICT,
    InvalidInput: status.HTTP_422_UNPROCESSABLE_CONTENT,
}


def _service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
    headers = {"Retry-After": str(exc.retry_after_seconds)} if isinstance(exc, (AccountLocked, RateLimited)) else None
    return JSONResponse(
        {"detail": exc.code},
        status_code=_ERROR_STATUS.get(type(exc), status.HTTP_400_BAD_REQUEST),
        headers=headers,
    )


def create_app() -> FastAPI:
    settings = get_settings()
    if settings.app_env != "development" and settings.jwt_secret is None:
        raise RuntimeError("JWT_SECRET is required outside development (generate one with `make env`)")
    configure_logging()
    app = FastAPI(title="VKO State Archive API", version="0.1.0")
    app.middleware("http")(log_requests)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Retry-After"],
    )
    app.add_exception_handler(ServiceError, _service_error_handler)
    app.include_router(health.router, prefix="/api")
    app.include_router(search.router, prefix="/api")
    app.include_router(files.router, prefix="/api")
    app.include_router(ai.router, prefix="/api")
    app.include_router(catalog.router, prefix="/api")
    app.include_router(legal.router, prefix="/api")
    app.include_router(content.router, prefix="/api")
    app.include_router(branches.router, prefix="/api")
    app.include_router(home.router, prefix="/api")
    app.include_router(memory.router, prefix="/api")
    app.include_router(exhibitions.router, prefix="/api")
    app.include_router(news.router, prefix="/api")
    app.include_router(cabinet.router, prefix="/api")
    app.include_router(admin.router, prefix="/api")
    return app


app = create_app()
