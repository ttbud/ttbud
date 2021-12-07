from datetime import timedelta
from asyncio import AbstractEventLoop
from functools import partial
from typing import Awaitable, TypeVar, Callable, AsyncIterator

import fakeredis.aioredis
import pytest
import time_machine
from aioredis import Redis
from pytest_lazyfixture import lazy_fixture

from src.rate_limit.rate_limit import (
    MAX_CONNECTIONS_PER_USER,
    TooManyConnectionsException,
    SERVER_LIVENESS_EXPIRATION_SECONDS,
    RateLimiter,
    MAX_ROOMS_PER_TEN_MINUTES,
    TooManyRoomsCreatedException,
    MAX_CONNECTIONS_PER_ROOM,
    RoomFullException,
)

from src.rate_limit.memory_rate_limit import (
    MemoryRateLimiter,
    MemoryRateLimiterStorage,
)

from src.rate_limit.redis_rate_limit import RedisRateLimiter, create_redis_rate_limiter

T = TypeVar('T', bound=RateLimiter)

GenericRateLimiterFactory = Callable[[str], Awaitable[T]]
RateLimiterFactory = GenericRateLimiterFactory[RateLimiter]

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def redis(event_loop: AbstractEventLoop) -> AsyncIterator[Redis]:
    redis_instance = fakeredis.aioredis.FakeRedis()
    yield redis_instance
    await redis_instance.close()


@pytest.fixture
def memory_rate_limiter_storage() -> MemoryRateLimiterStorage:
    return MemoryRateLimiterStorage()


@pytest.fixture
def redis_rate_limiter_factory(redis: Redis) -> RateLimiterFactory:
    return partial(create_redis_rate_limiter, redis=redis)


@pytest.fixture
def memory_rate_limiter_factory(
    memory_rate_limiter_storage: MemoryRateLimiterStorage,
) -> RateLimiterFactory:
    async def fn(server_id: str) -> MemoryRateLimiter:
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


def any_rate_limiter(func: Callable) -> Callable:
    return pytest.mark.parametrize(
        'rate_limiter',
        [
            lazy_fixture('memory_rate_limiter'),
            lazy_fixture('redis_rate_limiter'),
        ],
    )(func)


def any_rate_limiter_factory(func: Callable) -> Callable:
    return pytest.mark.parametrize(
        'rate_limiter_factory',
        [
            lazy_fixture('memory_rate_limiter_factory'),
            lazy_fixture('redis_rate_limiter_factory'),
        ],
    )(func)


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_user_connection_limit(rate_limiter: RateLimiter) -> None:
    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-1', f'room-{i}')

    with pytest.raises(TooManyConnectionsException):
        await rate_limiter.acquire_connection('user-1', 'room-unused')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_room_connection_limit(rate_limiter: RateLimiter) -> None:
    for i in range(0, MAX_CONNECTIONS_PER_ROOM):
        await rate_limiter.acquire_connection(f'user-{i}', 'room-1')

    with pytest.raises(RoomFullException):
        await rate_limiter.acquire_connection('user-last', 'room-1')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_release_connection(rate_limiter: RedisRateLimiter) -> None:
    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-1', f'room-{i}')

    await rate_limiter.release_connection('user-1', 'room-1')

    # This should succeed because we released one above
    await rate_limiter.acquire_connection('user-1', 'room-unused')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_release_room_slot(rate_limiter: RedisRateLimiter) -> None:
    for i in range(0, MAX_CONNECTIONS_PER_ROOM):
        await rate_limiter.acquire_connection(f'user-{i}', 'room-1')

    await rate_limiter.release_connection('user-1', 'room-1')

    await rate_limiter.acquire_connection('user-1', 'room-1')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_release_nonexistant_connection(rate_limiter: RateLimiter) -> None:
    # Releasing a connection that does not exist should not fail
    await rate_limiter.release_connection('user-1', 'room-nonexistant')

    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-1', f'room-{i}')

    # And you should still only be able to add only
    # MAX_CONNECTIONS_PER_USER connections
    with pytest.raises(TooManyConnectionsException):
        await rate_limiter.acquire_connection('user-1', 'room-unused')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_release_nonexistant_room_slot(rate_limiter: RateLimiter) -> None:
    # Releasing a connection that does not exist should not fail
    await rate_limiter.release_connection('user-1', 'room-1')

    for i in range(0, MAX_CONNECTIONS_PER_ROOM):
        await rate_limiter.acquire_connection(f'user-{i}', 'room-1')

    # And you should still only be able to add only
    # MAX_CONNECTIONS_PER_USER connections
    with pytest.raises(RoomFullException):
        await rate_limiter.acquire_connection('user-1', 'room-1')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_acquire_multiple_users(rate_limiter: RateLimiter) -> None:
    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-1', f'room-{i}')

    # Should succeed because we're acquiring a connection for a different user
    await rate_limiter.acquire_connection('user-2', 'room-unused')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_acquire_multiple_room_slots(rate_limiter: RateLimiter) -> None:
    for i in range(0, MAX_CONNECTIONS_PER_ROOM):
        await rate_limiter.acquire_connection(f'user-{i}', 'room-1')

    # Should succeed because we're acquiring a connection for a different room
    await rate_limiter.acquire_connection('user-1', 'room-different')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_multiple_room_users(rate_limiter: RateLimiter) -> None:
    for i in range(0, MAX_CONNECTIONS_PER_ROOM):
        await rate_limiter.acquire_connection(f'user-{i}', 'room-1')

    # Should fail because room slots are per-room not per-user
    with pytest.raises(RoomFullException):
        await rate_limiter.acquire_connection('user-1', 'room-1')


@any_rate_limiter_factory
@time_machine.travel('1970-01-01', tick=False)
async def test_acquire_multiple_servers(
    rate_limiter_factory: RateLimiterFactory,
) -> None:
    server_1 = await rate_limiter_factory('server-id-1')
    server_2 = await rate_limiter_factory('server-id-2')

    # Acquire the maximum number of connections across two servers
    for i in range(0, MAX_CONNECTIONS_PER_USER - 1):
        await server_1.acquire_connection('user-1', f'room-{i}')
    await server_2.acquire_connection('user-1', 'room-last')

    with pytest.raises(TooManyConnectionsException):
        await server_2.acquire_connection('user-1', 'room-another')


@any_rate_limiter_factory
@time_machine.travel('1970-01-01', tick=False)
async def test_room_limit_multiple_servers(
    rate_limiter_factory: RateLimiterFactory,
) -> None:
    server_1 = await rate_limiter_factory('server-id-1')
    server_2 = await rate_limiter_factory('server-id-2')

    # Acquire the maximum number of room slots across two servers
    for i in range(0, MAX_CONNECTIONS_PER_ROOM - 1):
        await server_1.acquire_connection(f'user-{i}', 'room-1')
    await server_2.acquire_connection('user-another', 'room-1')

    with pytest.raises(RoomFullException):
        await server_2.acquire_connection('user-last', 'room-1')


@any_rate_limiter_factory
@time_machine.travel('1970-01-01', tick=False)
async def test_release_connection_multiple_servers(
    rate_limiter_factory: RateLimiterFactory,
) -> None:
    server_1 = await rate_limiter_factory('server-id-1')
    server_2 = await rate_limiter_factory('server-id-2')

    # Acquire the maximum number of connections across two servers
    for i in range(0, MAX_CONNECTIONS_PER_USER - 1):
        await server_1.acquire_connection('user-1', f'room-{i}')
    await server_2.acquire_connection('user-1', 'room-another')

    # Release a connection for one server
    await server_1.release_connection('user-1', 'room-0')

    # Should work because we released a connection in server 1
    await server_2.acquire_connection('user-1', 'room-one-more')


@any_rate_limiter_factory
@time_machine.travel('1970-01-01', tick=False)
async def test_release_room_slot_multiple_servers(
    rate_limiter_factory: RateLimiterFactory,
) -> None:
    server_1 = await rate_limiter_factory('server-id-1')
    server_2 = await rate_limiter_factory('server-id-2')

    # Acquire the maximum number of connections across two servers
    for i in range(0, MAX_CONNECTIONS_PER_ROOM - 1):
        await server_1.acquire_connection(f'user-{i}', 'room-1')
    await server_2.acquire_connection('user-another', 'room-1')

    # Release a connection for one server
    await server_1.release_connection('user-another', 'room-1')

    # Should work because we released a connection in server 1
    await server_2.acquire_connection('user-another', 'room-1')


@any_rate_limiter_factory
async def test_acquire_connection_expired_server(
    rate_limiter_factory: RateLimiterFactory,
) -> None:
    # Create a server that will expire
    with time_machine.travel('1970-01-01') as traveller:
        expired_server = await rate_limiter_factory('server-id-1')

        for i in range(0, MAX_CONNECTIONS_PER_USER):
            await expired_server.acquire_connection('user-1', f'room-{i}')

        # Move forward in time to expire the server with all of the connections
        traveller.shift(timedelta(seconds=SERVER_LIVENESS_EXPIRATION_SECONDS + 1))
        live_server = await rate_limiter_factory('server-id-2')

        # Should be able to acquire connections because server-id-1 has expired
        await live_server.acquire_connection('user-1', 'room-last')


@any_rate_limiter_factory
async def test_acquire_room_slot_expired_server(
    rate_limiter_factory: RateLimiterFactory,
) -> None:
    # Create a server that will expire
    with time_machine.travel('1970-01-01') as traveller:
        expired_server = await rate_limiter_factory('server-id-1')

        for i in range(0, MAX_CONNECTIONS_PER_ROOM):
            await expired_server.acquire_connection(f'user-{i}', 'room-1')

        # Move forward in time to expire the server with all of the connections
        traveller.shift(timedelta(seconds=SERVER_LIVENESS_EXPIRATION_SECONDS + 1))
        live_server = await rate_limiter_factory('server-id-2')

        # Should be able to acquire a room slot because server-id-1 has expired
        await live_server.acquire_connection('user-1', 'room-1')


@any_rate_limiter_factory
async def test_refresh_server_liveness(
    rate_limiter_factory: RateLimiterFactory,
) -> None:
    with time_machine.travel('1970-01-01', tick=False) as traveller:
        # Create a server that will expire
        refreshing_server = await rate_limiter_factory('server-id-1')

        for i in range(0, MAX_CONNECTIONS_PER_USER):
            await refreshing_server.acquire_connection('user-1', f'room-{i}')

        traveller.shift(timedelta(seconds=SERVER_LIVENESS_EXPIRATION_SECONDS / 2))
        await refreshing_server.refresh_server_liveness(iter(['user-1']))

        # Move forward past expiration time if the server hadn't refreshed itself
        traveller.shift(timedelta(seconds=SERVER_LIVENESS_EXPIRATION_SECONDS))

        live_server = await rate_limiter_factory('server-id-2')

        # Should not be able to acquire connections because server-id-1 has not expired
        with pytest.raises(TooManyConnectionsException):
            await live_server.acquire_connection('user-1', 'room-last')


@any_rate_limiter_factory
@time_machine.travel('1970-01-01', tick=False)
async def test_context_manager(rate_limiter_factory: RateLimiterFactory) -> None:
    server = await rate_limiter_factory('server-id')

    for i in range(0, MAX_CONNECTIONS_PER_USER - 1):
        await server.acquire_connection('user-1', f'room-{i}')

    # Snag the last connection with a context manager
    async with server.rate_limited_connection('user-1', 'room-super-penultimate'):
        # Should fail to get new connections inside the context
        with pytest.raises(TooManyConnectionsException):
            await server.acquire_connection('user-1', 'room-penultimate')

    # Should succeed now that we've exited the context
    await server.acquire_connection('user-1', 'room-last')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_too_many_new_rooms(rate_limiter: RateLimiter) -> None:
    for i in range(0, MAX_ROOMS_PER_TEN_MINUTES):
        await rate_limiter.acquire_new_room('user-1')

    with pytest.raises(TooManyRoomsCreatedException):
        await rate_limiter.acquire_new_room('user-1')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_new_room_multiple_users(rate_limiter: RateLimiter) -> None:
    for i in range(0, MAX_ROOMS_PER_TEN_MINUTES):
        await rate_limiter.acquire_new_room('user-1')

    for i in range(0, MAX_ROOMS_PER_TEN_MINUTES):
        await rate_limiter.acquire_new_room('user-2')

    with pytest.raises(TooManyRoomsCreatedException):
        await rate_limiter.acquire_new_room('user-2')


@any_rate_limiter_factory
@time_machine.travel('1970-01-01', tick=False)
async def test_new_room_multiple_servers(
    rate_limiter_factory: RateLimiterFactory,
) -> None:
    server_1 = await rate_limiter_factory('server-1')
    server_2 = await rate_limiter_factory('server-2')

    for i in range(0, MAX_ROOMS_PER_TEN_MINUTES - 1):
        await server_1.acquire_new_room('user-1')

    await server_2.acquire_new_room('user-1')

    with pytest.raises(TooManyRoomsCreatedException):
        await server_2.acquire_new_room('user-1')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_release_connection_on_exception(rate_limiter: RateLimiter) -> None:
    for i in range(0, MAX_CONNECTIONS_PER_ROOM - 1):
        await rate_limiter.acquire_connection(f'user-{i}', 'room-1')

    with pytest.raises(NotImplementedError):
        async with rate_limiter.rate_limited_connection('user-penultimate', 'room-1'):
            raise NotImplementedError('Failed')

    # Should be allowed because the connection should be freed after the exception
    await rate_limiter.acquire_connection('user-last', 'room-1')


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_get_num_connections(rate_limiter: RateLimiter) -> None:
    assert await rate_limiter.get_total_num_connections() == 0
    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-1', 'room-1')
    assert await rate_limiter.get_total_num_connections() == MAX_CONNECTIONS_PER_USER
    for i in range(0, MAX_CONNECTIONS_PER_USER):
        await rate_limiter.acquire_connection('user-2', 'room-2')
    assert (
        await rate_limiter.get_total_num_connections() == 2 * MAX_CONNECTIONS_PER_USER
    )


@any_rate_limiter
@time_machine.travel('1970-01-01', tick=False)
async def test_no_connections(rate_limiter: RateLimiter) -> None:
    assert await rate_limiter.get_total_num_connections() == 0
    await rate_limiter.acquire_connection('user-1', 'room-1')
    await rate_limiter.release_connection('user-1', 'room-1')
    assert await rate_limiter.get_total_num_connections() == 0
