from contextlib import asynccontextmanager
from typing import AsyncGenerator, Iterator

from aioredis import Redis
from aioredis.client import Script

from src.apm import instrument
from src.rate_limit.rate_limit import (
    TooManyRoomsCreatedException,
    MAX_ROOMS_PER_TEN_MINUTES,
    SERVER_LIVENESS_EXPIRATION_SECONDS,
    RateLimiter,
    MAX_CONNECTIONS_PER_USER,
    MAX_CONNECTIONS_PER_ROOM,
    TooManyConnectionsException,
    RoomFullException,
)

_USER_LIVENESS_REFRESH_BATCH_SIZE = 50
_TEN_MINUTES_IN_SECONDS = 60 * 10

# Lua script to increment the connection count for a given user on the given
# server, if the user has not exceeded their connection count across all
# servers.
# Returns true if user has not exceeded their max connection count and the
# new connection has been recorded, false otherwise
# language=lua
_ACQUIRE_CONNECTION_SLOT = f"""
local connection_key = KEYS[1]
local target_server_id = ARGV[1]
local max_connections = tonumber(ARGV[2])

local server_ids = redis.call('hkeys', connection_key)

local total_connection_count = 0
for _, server_id in pairs(server_ids) do
    -- FIXME: This breaks redis cluster mode, because we don't declare these keys
    -- ahead of time
    local server_expired = not redis.call('get', 'api-server:' .. server_id)
    if server_expired then
        redis.call('hdel', connection_key, server_id)
    else
        local connection_count = tonumber(redis.call(
            'hget',
            connection_key,
            server_id
        ))
        if connection_count ~= nil then
            total_connection_count = total_connection_count + connection_count
        end
    end
end

if total_connection_count < max_connections then
    redis.call('hincrby', connection_key, target_server_id, 1)
    redis.call('expire', connection_key, {SERVER_LIVENESS_EXPIRATION_SECONDS})
    return true
else
    return false
end
"""

# language=lua
_RELEASE_CONNECTION_SLOT = """
    local connection_key = KEYS[1]
    local server_id = ARGV[1]

    local count = tonumber(redis.call('hget', connection_key, server_id))
    if count ~= nil and count > 0 then
        redis.call('hincrby', connection_key, server_id, -1)
    end
"""

# Increment the given key, and if the key is new, set its expiration
# to the given value in seconds.
# Returns the incremented value
# language=lua
_INCR_AND_EXPIRE_IF_NEW = """
    local key = KEYS[1]
    local expiration_secs = tonumber(ARGV[1])

    local value = tonumber(redis.call('incr', key))
    if value == 1 then
        redis.call('expire', key, expiration_secs)
    end

    return value
"""


class RedisRateLimiter(RateLimiter):
    """
    Rate limiter that coordinates across webservers using redis to limit
    active connections

    For performance reasons, this process makes the assumption that users
    connect and disconnect much more frequently than servers spin up and down.
    User-Server connection relationships are only garbage collected during the
    connection process for a given user, or after all connections for the user
    have been released.

    In the event of a server shutdown, reserved connections users have in that
    server will be released after SERVER_LIVENESS_EXPIRATION_SECONDS
    """

    def __init__(
        self,
        server_id: str,
        redis: Redis,
        acquire_connection: Script,
        release_connection: Script,
        incr_expire: Script,
    ):
        self._server_id = server_id
        self._redis = redis
        self._acquire_connection = acquire_connection
        self._release_connection = release_connection
        self._incr_expire = incr_expire

    @asynccontextmanager
    async def rate_limited_connection(
        self, user_id: str, room_id: str
    ) -> AsyncGenerator[None, None]:
        await self.acquire_connection(user_id, room_id)
        try:
            yield
        finally:
            await self.release_connection(user_id, room_id)

    @instrument
    async def refresh_server_liveness(self, user_ids: Iterator[str]) -> None:
        await self._redis.expire(
            f'api-server:{self._server_id}', SERVER_LIVENESS_EXPIRATION_SECONDS
        )

        # Update user liveness in batches so we don't block redis updating
        # every connected user at once
        async with self._redis.pipeline(transaction=False) as pipeline:
            for i, user_id in enumerate(user_ids):
                if i % _USER_LIVENESS_REFRESH_BATCH_SIZE == 0 and i != 0:
                    await pipeline.execute()
                await pipeline.expire(
                    f'user-connections:{user_id}', SERVER_LIVENESS_EXPIRATION_SECONDS
                )
            # Execute the last batch of refreshes regardless of size
            await pipeline.execute()

    @instrument
    async def acquire_connection(self, user_id: str, room_id: str) -> None:
        async with self._redis.pipeline() as pipeline:
            await self._acquire_connection(
                keys=[f'user-connections:{user_id}'],
                args=[self._server_id, MAX_CONNECTIONS_PER_USER],
                client=pipeline,
            )
            await self._acquire_connection(
                keys=[f'room-connections:{room_id}'],
                args=[self._server_id, MAX_CONNECTIONS_PER_ROOM],
                client=pipeline,
            )

            [open_connection_slot, open_room_slot] = await pipeline.execute()
            if not open_connection_slot:
                raise TooManyConnectionsException()
            if not open_room_slot:
                raise RoomFullException()

    @instrument
    async def release_connection(self, user_id: str, room_id: str) -> None:
        async with self._redis.pipeline() as pipeline:
            await self._release_connection(
                keys=[f'user-connections:{user_id}'],
                args=[self._server_id],
                client=pipeline,
            )
            await self._release_connection(
                keys=[f'room-connections:{room_id}'],
                args=[self._server_id],
                client=pipeline,
            )
            await pipeline.execute()

    @instrument
    async def acquire_new_room(self, user_id: str) -> None:
        recent_room_creation_count = await self._incr_expire(
            keys=[f'rate-limit:room-create:{user_id}'],
            args=[str(_TEN_MINUTES_IN_SECONDS)],
        )
        if recent_room_creation_count > MAX_ROOMS_PER_TEN_MINUTES:
            raise TooManyRoomsCreatedException

    @instrument
    async def get_total_num_connections(self) -> int:
        num_connections = 0
        async for entry in self._redis.scan_iter(match='user-connections:*'):
            async for _, count in self._redis.hscan_iter(entry):
                num_connections += int(count)
        return num_connections


async def create_redis_rate_limiter(server_id: str, redis: Redis) -> RedisRateLimiter:
    server_key = f'api-server:{server_id}'
    await redis.set(server_key, 'true', ex=SERVER_LIVENESS_EXPIRATION_SECONDS)
    acquire_connection = redis.register_script(_ACQUIRE_CONNECTION_SLOT)
    release_connection = redis.register_script(_RELEASE_CONNECTION_SLOT)
    incr_expire = redis.register_script(_INCR_AND_EXPIRE_IF_NEW)

    return RedisRateLimiter(
        server_id,
        redis,
        acquire_connection=acquire_connection,
        release_connection=release_connection,
        incr_expire=incr_expire,
    )
