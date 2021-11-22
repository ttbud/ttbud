from dataclasses import dataclass

from src.rate_limit.rate_limit import RateLimiter
from src.room_store.room_store import RoomStore


@dataclass
class UsageStats:
    seconds_since_last_activity: int
    num_connections: int


async def get_usage_stats(
    room_store: RoomStore, rate_limiter: RateLimiter
) -> UsageStats:
    return UsageStats(
        await room_store.seconds_since_last_activity(),
        await rate_limiter.get_total_num_connections(),
    )
