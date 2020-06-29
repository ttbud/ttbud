from asyncio import AbstractEventLoop
from functools import partial
from typing import Awaitable, TypeVar, Callable

import fakeredis.aioredis
import pytest
from aioredis import Redis
from pytest_mock import MockFixture

from src.rate_limit import (
    RedisRateLimiter,
    MAX_CONNECTIONS_PER_USER,
    TooManyConnectionsException,
    SERVER_LIVENESS_EXPIRATION_SECONDS,
    RateLimiter,
    MemoryRateLimiter,
    MemoryRateLimiterStorage,
    create_redis_rate_limiter,
)

T = TypeVar('T', bound=RateLimiter)

GenericRateLimiterFactory = Callable[[str], Awaitable[T]]
RateLimiterFactory = GenericRateLimiterFactory[RateLimiter]


@pytest.fixture
async def redis(event_loop: AbstractEventLoop):
    redis_instance = await fakeredis.aioredis.create_redis_pool()
    yield redis_instance
    redis_instance.close()
    await redis_instance.wait_closed()


@pytest.fixture
def memory_rate_limiter_storage():
    return MemoryRateLimiterStorage()


@pytest.fixture
def redis_rate_limiter_factory(redis: Redis):
    return partial(create_redis_rate_limiter, redis=redis)


@pytest.fixture
def memory_rate_limiter_factory(
    memory_rate_limiter_storage: MemoryRateLimiterStorage,
) -> RateLimiterFactory:
    async def fn(server_id: str):
        return MemoryRateLimiter(server_id, memory_rate_limiter_storage)

    return fn


@pytest.fixture
async def redis_rate_limiter(
    redis_rate_limiter_factory: GenericRateLimiterFactory[RedisRateLimiter],
) -> RedisRateLimiter:
    return await redis_rate_limiter_factory('server-id')


@pytest.fixture
async def memory_rate_limiter(
    memory_rate_limiter_factory: GenericRateLimiterFactory[MemoryRateLimiter],
) -> MemoryRateLimiter:
    return await memory_rate_limiter_factory('server-id')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'rate_limiter',
    [
        pytest.lazy_fixture('redis_rate_limiter'),
        pytest.lazy_fixture('memory_rate_limiter'),
    ],
)
async def test_connection_limit(rate_limiter: RateLimiter):
    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-1')

    with pytest.raises(TooManyConnectionsException):
        await rate_limiter.acquire_connection('user-1')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'rate_limiter',
    [
        pytest.lazy_fixture('redis_rate_limiter'),
        pytest.lazy_fixture('memory_rate_limiter'),
    ],
)
async def test_release_connection(rate_limiter: RedisRateLimiter):
    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-1')

    await rate_limiter.release_connection('user-1')

    # This should succeed because we released one above
    await rate_limiter.acquire_connection('user-1')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'rate_limiter',
    [
        pytest.lazy_fixture('redis_rate_limiter'),
        pytest.lazy_fixture('memory_rate_limiter'),
    ],
)
async def test_release_nonexistant_connection(rate_limiter: RateLimiter):
    # Releasing a connection that does not exist should not fail
    await rate_limiter.release_connection('user-1')

    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-1')

    # And you should still only be able to add only
    # MAX_CONNECTIONS_PER_USER connections
    with pytest.raises(TooManyConnectionsException):
        await rate_limiter.acquire_connection('user-1')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'rate_limiter',
    [
        pytest.lazy_fixture('redis_rate_limiter'),
        pytest.lazy_fixture('memory_rate_limiter'),
    ],
)
async def test_acquire_multiple_users(rate_limiter: RateLimiter):
    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-1')

    # Should succeed because we're acquiring a connection for a different user
    await rate_limiter.acquire_connection('user-2')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'rate_limiter_factory',
    [
        pytest.lazy_fixture('redis_rate_limiter_factory'),
        pytest.lazy_fixture('memory_rate_limiter_factory'),
    ],
)
async def test_acquire_multiple_servers(rate_limiter_factory: RateLimiterFactory):
    server_1 = await rate_limiter_factory('server-id-1')
    server_2 = await rate_limiter_factory('server-id-2')

    # Acquire the maximum number of connections across two servers
    for i in range(0, MAX_CONNECTIONS_PER_USER - 1):
        await server_1.acquire_connection('user-1')
    await server_2.acquire_connection('user-1')

    with pytest.raises(TooManyConnectionsException):
        await server_2.acquire_connection('user-1')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'rate_limiter_factory',
    [
        pytest.lazy_fixture('redis_rate_limiter_factory'),
        pytest.lazy_fixture('memory_rate_limiter_factory'),
    ],
)
async def test_release_multiple_servers(rate_limiter_factory: RateLimiterFactory):
    server_1 = await rate_limiter_factory('server-id-1')
    server_2 = await rate_limiter_factory('server-id-2')

    # Acquire the maximum number of connections across two servers
    for i in range(0, MAX_CONNECTIONS_PER_USER - 1):
        await server_1.acquire_connection('user-1')
    await server_2.acquire_connection('user-1')

    # Release a connection for one server
    await server_1.release_connection('user-1')

    # Should work because we released a connection in server 1
    await server_2.acquire_connection('user-1')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'rate_limiter_factory',
    [
        pytest.lazy_fixture('redis_rate_limiter_factory'),
        pytest.lazy_fixture('memory_rate_limiter_factory'),
    ],
)
async def test_expired_server(
    rate_limiter_factory: RateLimiterFactory, mocker: MockFixture
):

    # Create a server that will expire
    mocker.patch('time.time', return_value=0)
    expired_server = await rate_limiter_factory('server-id-1')

    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await expired_server.acquire_connection('user-1')

    # Move forward in time to expire the server with all of the connections
    mocker.patch('time.time', return_value=SERVER_LIVENESS_EXPIRATION_SECONDS + 1)

    live_server = await rate_limiter_factory('server-id-2')

    # Should be able to acquire connections because server-id-1 has expired
    await live_server.acquire_connection('user-1')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'rate_limiter_factory',
    [
        pytest.lazy_fixture('redis_rate_limiter_factory'),
        pytest.lazy_fixture('memory_rate_limiter_factory'),
    ],
)
async def test_refresh_server_liveness(
    rate_limiter_factory: RateLimiterFactory, mocker: MockFixture
):
    # Create a server that will expire
    mocker.patch('time.time', return_value=0)
    refreshing_server = await rate_limiter_factory('server-id-1')

    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await refreshing_server.acquire_connection('user-1')

    mocker.patch('time.time', return_value=SERVER_LIVENESS_EXPIRATION_SECONDS)
    await refreshing_server.refresh_server_liveness(iter(['user-1']))

    # Move forward past expiration time if the server hadn't refreshed itself
    mocker.patch('time.time', return_value=SERVER_LIVENESS_EXPIRATION_SECONDS + 1)

    live_server = await rate_limiter_factory('server-id-2')

    # Should not be able to acquire connections because server-id-1 has not expired
    with pytest.raises(TooManyConnectionsException):
        await live_server.acquire_connection('user-1')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'rate_limiter_factory',
    [
        pytest.lazy_fixture('redis_rate_limiter_factory'),
        pytest.lazy_fixture('memory_rate_limiter_factory'),
    ],
)
async def test_context_manager(rate_limiter_factory: RateLimiterFactory):
    server = await rate_limiter_factory('server-id')

    for i in range(0, MAX_CONNECTIONS_PER_USER - 1):
        await server.acquire_connection('user-1')

    # Snag the last connection with a context manager
    async with server.rate_limited_connection('user-1'):
        # Should fail to get new connections inside the context
        with pytest.raises(TooManyConnectionsException):
            await server.acquire_connection('user-1')

    # Should succeed now that we've exited the context
    await server.acquire_connection('user-1')
