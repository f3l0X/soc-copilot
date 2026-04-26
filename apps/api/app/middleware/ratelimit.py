"""Lightweight in-memory per-IP rate limiter.

Sliding window using a deque of timestamps per client IP. Suitable for a
single-process uvicorn dev/demo deployment. For multi-worker prod, swap
the backing store for Redis (out of scope for this phase).

Trust model: identifies clients by `request.client.host`. When a reverse
proxy (Caddy in prod) sits in front, configure it to forward the real
client IP via the connection (not headers) — or replace this with a
header-aware variant once the proxy contract is fixed.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.config import get_settings

_buckets: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def reset() -> None:
    """Test helper — clear all buckets."""
    with _lock:
        _buckets.clear()


def _client_id(request: Request) -> str:
    if request.client is None:
        return "unknown"
    return request.client.host


def rate_limit(request: Request) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return

    ident = _client_id(request)
    now = time.monotonic()
    window = settings.rate_limit_window_seconds
    limit = settings.rate_limit_requests

    with _lock:
        bucket = _buckets[ident]
        cutoff = now - window
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="rate limit exceeded",
            )
        bucket.append(now)
