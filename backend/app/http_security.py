"""HTTP security headers of the API (T7.4).

The API serves JSON and stored files only, never pages: its CSP forbids everything, the
response may not be framed or sniffed, and no Referer leaves it. A route that needs other
values sets them itself (the file download sends its own sandboxed CSP), so existing
headers are never overwritten. HSTS is sent only in production (APP_ENV=production),
where the API is served over HTTPS.
"""

from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import Response

API_HEADERS: dict[str, str] = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}
HSTS = "max-age=31536000; includeSubDomains"


def security_headers_middleware(production: bool) -> Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]:
    headers = {**API_HEADERS, **({"Strict-Transport-Security": HSTS} if production else {})}

    async def add_security_headers(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        for name, value in headers.items():
            response.headers.setdefault(name, value)
        return response

    return add_security_headers
