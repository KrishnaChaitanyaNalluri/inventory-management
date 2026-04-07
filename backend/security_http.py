"""
HTTP security helpers: response headers and login rate limiting.
"""
from __future__ import annotations

import threading
import time

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response

import settings

_lock = threading.Lock()
_sliding: dict[str, list[float]] = {}


def _trim_window(events: list[float], window_sec: float, now: float) -> None:
    events[:] = [t for t in events if now - t < window_sec]


def _enforce_sliding_limit(key: str, max_events: int, window_sec: float) -> None:
    now = time.time()
    with _lock:
        bucket = _sliding.setdefault(key, [])
        _trim_window(bucket, window_sec, now)
        if len(bucket) >= max_events:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please wait and try again.",
            )
        bucket.append(now)


def enforce_login_rate_limit(request: Request, identifier: str) -> None:
    if not settings.LOGIN_RATE_ENABLED:
        return
    ident = (identifier or "").strip().lower()
    if not ident:
        return
    _enforce_sliding_limit(
        f"login:id:{ident}",
        settings.LOGIN_RATE_PER_ID_MAX,
        float(settings.LOGIN_RATE_PER_ID_WINDOW_SEC),
    )
    ip = request.client.host if request.client else "unknown"
    _enforce_sliding_limit(
        f"login:ip:{ip}",
        settings.LOGIN_RATE_PER_IP_MAX,
        float(settings.LOGIN_RATE_PER_IP_WINDOW_SEC),
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Baseline headers for API responses (helps browsers enforce safe defaults)."""

    async def dispatch(self, request: StarletteRequest, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )
        return response
