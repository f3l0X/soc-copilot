"""Lightweight in-memory per-IP rate limiter.

Sliding window using a deque of timestamps per client. Suitable for a
single-process uvicorn dev/demo deployment. For multi-worker prod, swap
the backing store for Redis (out of scope for this phase).

Trust model: when running behind a trusted reverse proxy (Caddy in prod)
the real client IP is taken from the leftmost X-Forwarded-For entry. The
proxy hop must terminate that header so it cannot be spoofed by clients.
Outside of a trusted-proxy context we fall back to the socket peer.

Buckets are keyed by ``<scope>:<client>`` so per-route limits (e.g. a
strict bucket for /auth/login) don't share quota with general traffic
and so unknown clients don't all collapse into a single shared bucket.
"""
from __future__ import annotations

import ipaddress
import threading
import time
import uuid
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.config import get_settings

_buckets: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def reset() -> None:
    """Test helper — clear all buckets."""
    with _lock:
        _buckets.clear()


def _trusted_proxy_hop() -> bool:
    """Whether to trust X-Forwarded-For. True when running behind Caddy."""
    return get_settings().is_production


def _client_id(request: Request) -> str:
    # Behind a trusted proxy use the leftmost XFF entry (the original
    # client). Validate it's a real IP so a header like
    # "Forwarded: foo, bar" can't poison the bucket key.
    if _trusted_proxy_hop():
        xff = request.headers.get("x-forwarded-for")
        if xff:
            candidate = xff.split(",")[0].strip()
            try:
                ipaddress.ip_address(candidate)
                return candidate
            except ValueError:
                pass
    if request.client is not None and request.client.host:
        return request.client.host
    # Avoid funnelling every clientless request into one shared bucket
    # (which would make a single peer DoS everyone). Give each request a
    # unique identity instead — slightly leaky but non-amplifying.
    return f"anon:{uuid.uuid4().hex}"


def _check(scope: str, ident: str, limit: int, window: int) -> None:
    if limit <= 0:
        return
    now = time.monotonic()
    key = f"{scope}:{ident}"
    with _lock:
        bucket = _buckets[key]
        cutoff = now - window
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="rate limit exceeded",
            )
        bucket.append(now)


def rate_limit(request: Request) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return
    _check(
        "global",
        _client_id(request),
        settings.rate_limit_requests,
        settings.rate_limit_window_seconds,
    )


def auth_rate_limit(request: Request) -> None:
    """Strict bucket for credential endpoints (login/register).

    Always on — even if RATE_LIMIT_ENABLED=false — because brute-force
    protection on auth must never depend on a feature flag.
    """
    settings = get_settings()
    ident = _client_id(request)
    # 5 attempts per minute per client. Independent of the global bucket.
    _check("auth", ident, 5, max(settings.rate_limit_window_seconds, 60))
