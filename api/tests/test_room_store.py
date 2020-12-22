import asyncio
from typing import Callable, Awaitable, AsyncIterator, List

import fakeredis.aioredis
import pytest
from aioredis import Redis

from src.api.api_structures import Request, Update
from src.room_store.memory_room_store import (
    MemoryRoomStore,
    MemoryRoomStorage,
)
from src.room_store.redis_room_store import create_redis_room_store, RedisRoomStore
from src.room_store.room_store import (
    RoomStore,
)
from src.util.async_util import async_collect
from tests.static_fixtures import (
    VALID_ACTION,
    PING_ACTION,
    TEST_REQUEST_ID,
    TEST_ROOM_ID,
    VALID_REQUEST,
)

pytestmark = pytest.mark.asyncio


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


def any_room_store(func: Callable) -> Callable:
    return pytest.mark.parametrize(
        'room_store',
        [
            pytest.lazy_fixture('memory_room_store'),
            pytest.lazy_fixture('redis_room_store'),
        ],
    )(func)


@any_room_store
async def test_mutate_and_read(room_store: RoomStore) -> None:
    updates: List[Update] = [VALID_ACTION, PING_ACTION]
    await room_store.add_update(TEST_ROOM_ID, Request(TEST_REQUEST_ID, updates))
    assert list(await room_store.read(TEST_ROOM_ID)) == [VALID_ACTION]


@any_room_store
async def test_list_all_keys(room_store: RoomStore) -> None:
    await room_store.add_update('room-id-1', VALID_REQUEST)
    await room_store.add_update('room-id-2', VALID_REQUEST)

    assert (await async_collect(room_store.get_all_room_ids())) == [
        'room-id-1',
        'room-id-2',
    ]


@any_room_store
async def test_change_notifications(room_store: RoomStore) -> None:
    changes = await room_store.changes(TEST_ROOM_ID)
    sub_task = asyncio.create_task(async_collect(changes, count=1))

    await room_store.add_update(TEST_ROOM_ID, VALID_REQUEST)
    reply = await sub_task
    assert reply == [VALID_REQUEST]
