"""Limits on how often one network address may do something (e.g. fail to log in), so nobody in
the Kita's network can guess passwords or flood the developer's inbox. Kept in memory: a restart
of the API forgets them, which only ever lets someone start again from nothing."""

from collections import defaultdict, deque
from datetime import datetime, timedelta
from threading import Lock

from kita.clock import Clock


class AttemptLimit:
    """At most `max_attempts` counted attempts per key within any `period`."""

    def __init__(self, clock: Clock, max_attempts: int, period: timedelta) -> None:
        self._clock = clock
        self._max_attempts = max_attempts
        self._period = period
        self._attempts: defaultdict[str, deque[datetime]] = defaultdict(deque)
        # FastAPI runs plain routes in a thread pool.
        self._lock = Lock()

    @property
    def max_attempts(self) -> int:
        return self._max_attempts

    @property
    def period(self) -> timedelta:
        return self._period

    def retry_after(self, key: str) -> timedelta | None:
        """How long until `key` may try again, or None if it may now."""
        now = self._clock.now()
        with self._lock:
            attempts = self._recent(key, now)
            if len(attempts) < self._max_attempts:
                return None
            return attempts[-self._max_attempts] + self._period - now

    def record(self, key: str) -> None:
        """Records an attempt by `key`, now."""
        now = self._clock.now()
        with self._lock:
            self._recent(key, now).append(now)

    def _recent(self, key: str, now: datetime) -> deque[datetime]:
        """The key's attempts within the period, older ones dropped (and keys with none)."""
        attempts = self._attempts[key]
        while attempts and attempts[0] <= now - self._period:
            attempts.popleft()
        if not attempts:
            del self._attempts[key]
            attempts = self._attempts[key]
        return attempts
