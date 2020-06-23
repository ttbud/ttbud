from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Dict, Protocol, AsyncGenerator, AsyncContextManager, Iterator

from aioredis import Redis

MAX_CONNECTIONS_PER_USER = 10
SERVER_LIVENESS_EXPIRATION_SECONDS = 60 * 10


class TooManyConnectionsException(Exception):
    pass


class RateLimiter(Protocol):
    async def acquire_connection(self, user_id: str) -> None:
        """
        Reserve a connection for user identified by user_id.
        :param user_id: A string uniquely identifying the user, should be the
        same across servers like the IP address of the user
        :raises TooManyConnectionsException if the user already has
        MAX_CONNECTIONS_PER_USER active connections
        """
        ...

    async def release_connection(self, user_id: str) -> None:
        """
        Release a connection for the given user id
        :param user_id: A string uniquely identifying the user, should be the
        same across servers like the IP address of the user
        """
        ...

    def rate_limited_connection(self, user_id: str) -> AsyncContextManager:
        """
        Reserve a connection for the given user_id for the duration of the
        context
        :param user_id: A string uniquely identifying the user, should be the
        same across servers like the IP address of the user
        :raises TooManyConnectionsException if the user already has
        MAX_CONNECTIONS_PER_USER active connections
        """
        ...

    async def refresh_server_liveness(self, user_ids: Iterator[str]) -> None:
        """
        This function should be called every
        SERVER_LIVENESS_EXPIRATION_SECONDS/3 while the server is operating
        """
        ...


_USER_LIVENESS_REFRESH_BATCH_SIZE = 50

# Lua script to increment the connection count for a given user on the given
# server, if the user has not exceeded their connection count across all
# servers.
# Returns true if user has not exceeded their max connection count and the
# new connection has been recorded, false otherwise
# language=lua
ACQUIRE_CONNECTION_SLOT = f"""
local user_id = ARGV[1]
local target_server_id = ARGV[2]

local user_connections_key = 'user-connections:' .. user_id
local server_ids = redis.call('hkeys', user_connections_key)

local total_connection_count = 0
for _, server_id in pairs(server_ids) do
    local server_expired = not redis.call('get', 'api-server:' .. server_id)
    if server_expired then
        redis.call('hdel', user_connections_key, server_id)
    else
        local server_connection_count = redis.call(
            'hget',
            user_connections_key,
            server_id
        )
        if server_connection_count ~= false then
            total_connection_count = total_connection_count + server_connection_count
        end
    end
end

if total_connection_count < {MAX_CONNECTIONS_PER_USER} then
    redis.call('hincrby', user_connections_key, target_server_id, 1)
    redis.call('expire', user_connections_key, {SERVER_LIVENESS_EXPIRATION_SECONDS})
    return true
else
    return false
end
"""

# language=lua
RELEASE_CONNECTION_SLOT = """
    local user_id = ARGV[1]
    local server_id = ARGV[2]

    local user_key = 'user-connections:' .. user_id
    local count = tonumber(redis.call('hget', user_key, server_id))
    if count ~= nil and count > 0 then
        redis.call('hincrby', user_key, server_id, -1)
    end
"""


async def create_redis_rate_limiter(server_id: str, redis: Redis) -> RedisRateLimiter:
    server_key = f'api-server:{server_id}'
    initialize_futures = [
        redis.script_load(ACQUIRE_CONNECTION_SLOT),
        redis.script_load(RELEASE_CONNECTION_SLOT),
        redis.set(server_key, "true"),
        redis.expire(server_key, SERVER_LIVENESS_EXPIRATION_SECONDS),
    ]
    [acquire_sha, release_sha, *_] = await asyncio.gather(*initialize_futures)

    return RedisRateLimiter(
        server_id,
        redis,
        acquire_connection_sha=acquire_sha,
        release_connection_sha=release_sha,
    )


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
        acquire_connection_sha: bytes,
        release_connection_sha: bytes,
    ):
        self._server_id = server_id
        self._redis = redis
        self._acquire_connection_sha = acquire_connection_sha
        self._release_connection_sha = release_connection_sha

    @asynccontextmanager
    async def rate_limited_connection(self, user_id: str) -> AsyncGenerator:
        await self.acquire_connection(user_id)
        yield
        await self.release_connection(user_id)

    async def refresh_server_liveness(self, user_ids: Iterator[str]) -> None:
        await self._redis.expire(
            f'api-server:{self._server_id}', SERVER_LIVENESS_EXPIRATION_SECONDS
        )

        # Update user liveness in batches so we don't block redis updating
        # every connected user at once
        transaction = self._redis.multi_exec()
        for i, user_id in enumerate(user_ids):
            if i % _USER_LIVENESS_REFRESH_BATCH_SIZE == 0 and i != 0:
                await transaction.execute()
                transaction = self._redis.multi_exec()
            transaction.expire(
                f'user-connections:{user_id}', SERVER_LIVENESS_EXPIRATION_SECONDS
            )

        # Execute the last batch of refreshes regardless of size
        await transaction.execute()

    async def acquire_connection(self, user_id: str) -> None:
        success = await self._redis.evalsha(
            self._acquire_connection_sha, args=[user_id, self._server_id],
        )
        if not success:
            raise TooManyConnectionsException()

    async def release_connection(self, user_id: str) -> None:
        await self._redis.evalsha(
            self._release_connection_sha, args=[user_id, self._server_id]
        )


@dataclass
class MemoryRateLimiterStorage:
    servers: Dict[str, float] = field(default_factory=dict)
    users: Dict[str, Dict[str, int]] = field(default_factory=dict)


class MemoryRateLimiter(RateLimiter):
    def __init__(self, server_id: str, storage: MemoryRateLimiterStorage):
        self._server_id = server_id
        self._storage = storage
        self._storage.servers[server_id] = (
            time.time() + SERVER_LIVENESS_EXPIRATION_SECONDS
        )

    @asynccontextmanager
    async def rate_limited_connection(self, user_id: str) -> AsyncGenerator:
        await self.acquire_connection(user_id)
        yield
        await self.release_connection(user_id)

    async def acquire_connection(self, user_id: str) -> None:
        now = time.time()
        user_connections = self._storage.users.get(user_id, {})

        connection_count = 0
        for server_id, count in user_connections.items():
            if self._storage.servers[server_id] > now:
                connection_count += count

        if connection_count >= MAX_CONNECTIONS_PER_USER:
            raise TooManyConnectionsException()

        server_connection_count = user_connections.get(self._server_id, 0)
        user_connections[self._server_id] = server_connection_count + 1
        self._storage.users[user_id] = user_connections

    async def release_connection(self, user_id: str) -> None:
        user_connections = self._storage.users.get(user_id)
        if not user_connections:
            return None

        server_connection_count = user_connections.get(self._server_id, 0)
        if server_connection_count:
            user_connections[self._server_id] = server_connection_count - 1

    async def refresh_server_liveness(self, user_ids: Iterator[str]) -> None:
        self._storage.servers[self._server_id] = (
            time.time() + SERVER_LIVENESS_EXPIRATION_SECONDS
        )
