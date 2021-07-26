import asyncio
import random
import time
from typing import Any, AsyncIterator, Callable, Awaitable

import fakeredis
import pytest
from aioredis import Redis
from pytest_mock import MockerFixture

from src.room_store.memory_room_archive import MemoryRoomArchive
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.room_store.merged_room_store import MergedRoomStore
from src.room_store.redis_room_store import RedisRoomStore, create_redis_room_store


@pytest.fixture(autouse=True)
def disable_sleep(mocker: MockerFixture) -> None:
    """Disable sleep in all tests by default"""

    original_sleep = asyncio.sleep

    # We don't want to actually sleep for any amount of time, but we do want to
    # allow functions to yield the event loop, so convert all sleep calls to sleep(0)
    async def sleep(*args: Any, **kwargs: Any) -> None:
        await original_sleep(0)

    mocker.patch('asyncio.sleep', sleep)


@pytest.fixture(autouse=True)
def fix_monotonic(mocker: MockerFixture) -> None:
    """Time machine does not work with time.monotonic. Use time.time in tests instead"""
    mocker.patch('time.monotonic', time.time)


@pytest.fixture(autouse=True)
def fix_random() -> None:
    """Force a consistent seed so there's no randomness in tests"""
    random.seed(1)


# If we don't depend on event_loop (even though it isn't explicitly used), then it
# won't be set up early enough for create_redis_pool to find it, and tests and redis
# will get two different event loops that will deadlock waiting for each other
@pytest.fixture
async def redis(event_loop: asyncio.AbstractEventLoop) -> AsyncIterator[Redis]:
    redis_instance = await fakeredis.aioredis.create_redis_pool()
    yield redis_instance
    redis_instance.close()
    await redis_instance.wait_closed()


@pytest.fixture
def redis_room_store_factory(redis: Redis) -> Callable[[], Awaitable[RedisRoomStore]]:
    return lambda: create_redis_room_store(redis)


@pytest.fixture
async def redis_room_store(
    redis_room_store_factory: Callable[[], Awaitable[RedisRoomStore]]
) -> RedisRoomStore:
    return await redis_room_store_factory()


@pytest.fixture
async def merged_room_store(
    memory_room_store: MemoryRoomStore, memory_room_archive: MemoryRoomArchive
) -> MergedRoomStore:
    return MergedRoomStore(memory_room_store, memory_room_archive)


@pytest.fixture
def memory_room_storage() -> MemoryRoomStorage:
    return MemoryRoomStorage()


@pytest.fixture
def memory_room_store_factory(
    memory_room_storage: MemoryRoomStorage,
) -> Callable[[], Awaitable[MemoryRoomStore]]:
    async def fn() -> MemoryRoomStore:
        return MemoryRoomStore(memory_room_storage)

    return fn


@pytest.fixture
async def memory_room_store(
    memory_room_store_factory: Callable[[], Awaitable[MemoryRoomStore]]
) -> MemoryRoomStore:
    return await memory_room_store_factory()


@pytest.fixture
async def memory_room_archive() -> MemoryRoomArchive:
    return MemoryRoomArchive()
