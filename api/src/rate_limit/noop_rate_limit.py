from contextlib import asynccontextmanager
from typing import Iterator, AsyncGenerator

from src.rate_limit.rate_limit import RateLimiter


class NoopRateLimiter(RateLimiter):
    """Rate limiter that does not enforce any rate limits"""

    async def acquire_connection(self, user_id: str, room_id: str) -> None:
        pass

    async def release_connection(self, user_id: str, room_id: str) -> None:
        pass

    @asynccontextmanager
    async def rate_limited_connection(
        self, user_id: str, room_id: str
    ) -> AsyncGenerator[None, None]:
        yield

    async def refresh_server_liveness(self, user_ids: Iterator[str]) -> None:
        pass

    async def acquire_new_room(self, user_id: str) -> None:
        pass
