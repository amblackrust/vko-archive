"""Domain errors raised by services. `app.main` maps them to HTTP responses,
so services do not depend on FastAPI."""


class ServiceError(Exception):
    """Base class. `code` is a stable machine-readable string returned as `detail`."""

    code = "error"

    def __init__(self, code: str | None = None) -> None:
        super().__init__(code or self.code)
        if code:
            self.code = code


class NotAuthenticated(ServiceError):
    code = "not_authenticated"


class InvalidCredentials(ServiceError):
    code = "invalid_credentials"


class AccountLocked(ServiceError):
    code = "account_locked"

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__()
        self.retry_after_seconds = retry_after_seconds


class RateLimited(ServiceError):
    code = "rate_limited"

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__()
        self.retry_after_seconds = retry_after_seconds


class CsrfFailed(ServiceError):
    code = "csrf_failed"


class PermissionDenied(ServiceError):
    code = "forbidden"


class NotFound(ServiceError):
    code = "not_found"


class Conflict(ServiceError):
    code = "conflict"


class InvalidInput(ServiceError):
    code = "invalid_input"
