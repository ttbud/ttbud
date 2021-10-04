import asyncio
import random
import time
from typing import Any, AsyncIterator

import pytest
from aioredis import Redis
from fakeredis.aioredis import FakeRedis
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


@pytest.fixture
async def redis() -> AsyncIterator[Redis]:
    redis_instance = FakeRedis()
    yield redis_instance
    await redis_instance.close()


@pytest.fixture
async def redis_room_store(redis: Redis) -> AsyncIterator[RedisRoomStore]:
    async with create_redis_room_store(redis) as room_store:
        yield room_store


@pytest.fixture
async def merged_room_store(
    memory_room_store: MemoryRoomStore, memory_room_archive: MemoryRoomArchive
) -> MergedRoomStore:
    return MergedRoomStore(memory_room_store, memory_room_archive)


@pytest.fixture
def memory_room_store() -> MemoryRoomStore:
    return MemoryRoomStore(MemoryRoomStorage())


@pytest.fixture
async def memory_room_archive() -> MemoryRoomArchive:
    return MemoryRoomArchive()
