import asyncio
from datetime import timedelta
from typing import Callable, Awaitable, AsyncIterator, List

import fakeredis.aioredis
import pytest
import time_machine
from aioredis import Redis
from pytest_lazyfixture import lazy_fixture

from src.api.api_structures import Request, Action
from src.room_store.memory_room_store import (
    MemoryRoomStore,
    MemoryRoomStorage,
)
from src.room_store.redis_room_store import create_redis_room_store, RedisRoomStore
from src.room_store.room_store import (
    RoomStore,
    UnexpectedReplacementId,
    COMPACTION_LOCK_EXPIRATION_SECONDS,
)
from src.util.async_util import async_collect
from tests.static_fixtures import (
    VALID_ACTION,
    PING_ACTION,
    TEST_REQUEST_ID,
    TEST_ROOM_ID,
    VALID_REQUEST,
    ANOTHER_VALID_ACTION,
    DELETE_REQUEST,
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
        [lazy_fixture('memory_room_store'), lazy_fixture('redis_room_store')],
    )(func)


@any_room_store
async def test_mutate_and_read(room_store: RoomStore) -> None:
    updates: List[Action] = [VALID_ACTION, PING_ACTION]
    await room_store.add_request(TEST_ROOM_ID, Request(TEST_REQUEST_ID, updates))
    assert list(await room_store.read(TEST_ROOM_ID)) == [VALID_ACTION]


@any_room_store
async def test_list_all_keys(room_store: RoomStore) -> None:
    await room_store.add_request('room-id-1', VALID_REQUEST)
    await room_store.add_request('room-id-2', VALID_REQUEST)

    assert (await async_collect(room_store.get_all_room_ids())) == [
        'room-id-1',
        'room-id-2',
    ]


@any_room_store
async def test_change_notifications(room_store: RoomStore) -> None:
    changes = await room_store.changes(TEST_ROOM_ID)
    sub_task = asyncio.create_task(async_collect(changes, count=1))

    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    reply = await sub_task
    assert reply == [VALID_REQUEST]


@any_room_store
async def test_replacement_lock(room_store: RoomStore) -> None:
    success = await room_store.acquire_replacement_lock('compaction_id_1')
    assert success

    success = await room_store.acquire_replacement_lock('compaction_id_2')
    assert not success


@any_room_store
async def test_replace(room_store: RoomStore) -> None:
    await room_store.add_request('room-id-1', VALID_REQUEST)

    await room_store.acquire_replacement_lock('compaction_id')
    replace_data = await room_store.read_for_replacement('room-id-1')
    assert replace_data.actions == [VALID_ACTION]

    await room_store.replace(
        'room-id-1', [ANOTHER_VALID_ACTION], replace_data.replace_token, 'compaction_id'
    )
    assert list(await room_store.read('room-id-1')) == [ANOTHER_VALID_ACTION]


@any_room_store
async def test_replace_concurrent_updates(room_store: RoomStore) -> None:
    await room_store.add_request('room-id-1', VALID_REQUEST)

    await room_store.acquire_replacement_lock('compaction_id')
    replace_data = await room_store.read_for_replacement('room-id-1')
    await room_store.add_request('room-id-1', DELETE_REQUEST)
    assert replace_data.actions == [VALID_ACTION]

    replace_actions: List[Action] = [ANOTHER_VALID_ACTION]
    await room_store.replace(
        'room-id-1', replace_actions, replace_data.replace_token, 'compaction_id'
    )
    actions = list(await room_store.read('room-id-1'))

    assert actions == replace_actions + DELETE_REQUEST.actions


@any_room_store
async def test_replace_invalid_lock(room_store: RoomStore) -> None:
    await room_store.acquire_replacement_lock('compaction_id')
    replace_data = await room_store.read_for_replacement('room-id')
    with pytest.raises(UnexpectedReplacementId):
        await room_store.replace(
            'room-id',
            [ANOTHER_VALID_ACTION],
            replace_data.replace_token,
            'invalid-compaction-id',
        )


@any_room_store
async def test_replace_with_expired_replacer_id(room_store: RoomStore) -> None:
    with time_machine.travel('1970-01-01', tick=False) as traveller:
        await room_store.acquire_replacement_lock('compaction_id')
        replace_data = await room_store.read_for_replacement('room-id')
        # Move forward in time to expire the replacer_id
        traveller.shift(timedelta(seconds=COMPACTION_LOCK_EXPIRATION_SECONDS + 1))
        with pytest.raises(UnexpectedReplacementId):
            await room_store.replace(
                'room-id',
                [ANOTHER_VALID_ACTION],
                replace_data.replace_token,
                'compaction_id',
            )


@any_room_store
async def test_delete_room(room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.acquire_replacement_lock('replacer_id')
    await room_store.delete(TEST_ROOM_ID, 'replacer_id')
    assert await room_store.room_exists(TEST_ROOM_ID) is False


@any_room_store
async def test_delete_with_expired_replacer_id(room_store: RoomStore) -> None:
    with time_machine.travel('1970-01-01', tick=False) as traveller:
        await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
        await room_store.acquire_replacement_lock('replacer_id')

        # Move forward in time to expire the replacer_id
        traveller.shift(timedelta(seconds=COMPACTION_LOCK_EXPIRATION_SECONDS + 1))
        with pytest.raises(UnexpectedReplacementId):
            await room_store.delete(TEST_ROOM_ID, 'replacer_id')


@any_room_store
async def test_force_acquire_room_lock(room_store: RoomStore) -> None:
    await room_store.acquire_replacement_lock('old-replacer-id')
    await room_store.force_acquire_replacement_lock('new-replacer-id')

    await room_store.delete(TEST_ROOM_ID, 'new-replacer-id')

    with pytest.raises(UnexpectedReplacementId):
        await room_store.delete(TEST_ROOM_ID, 'old-replacer-id')
