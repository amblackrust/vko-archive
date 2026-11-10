"""In-memory per-key sliding-window rate limit (one process; enough for the single
backend instance of the demo — behind several workers each keeps its own window)."""

import math
import threading
import time
from collections import deque


class RateLimiter:
    def __init__(self, window_seconds: float = 60.0) -> None:
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int) -> int | None:
        """Counts a request. None if allowed, else seconds until the next one is allowed.
        `limit <= 0` disables the limit."""
        if limit <= 0:
            return None
        now = time.monotonic()
        with self._lock:
            # Drop keys whose window has passed, so the table does not grow without bound.
            for stale in [k for k, hits in self._hits.items() if hits[-1] <= now - self.window]:
                del self._hits[stale]
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= limit:
                return max(1, math.ceil(hits[0] + self.window - now))
            hits.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


# /api/ai/parse and /api/ai/answer* (each may start an LLM generation).
ai_limiter = RateLimiter()
