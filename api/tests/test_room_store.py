from dataclasses import asdict

import fakeredis.aioredis
import pytest

from src.async_collect import async_collect
from src.room_store import MemoryRoomStore, RedisRoomStore, RoomStore

from tests.static_fixtures import VALID_TOKEN


# If we don't depend on event_loop (even though it isn't explicitly used), then it
# won't be set up early enough for create_redis_pool to find it, and tests and redis
# will get two different event loops that will deadlock waiting for each other
@pytest.fixture
async def redis(event_loop):
    redis_instance = await fakeredis.aioredis.create_redis_pool()
    yield redis_instance
    redis_instance.close()
    await redis_instance.wait_closed()


@pytest.fixture
async def redis_room_store(redis):
    return RedisRoomStore(redis)


@pytest.fixture
def memory_room_store():
    return MemoryRoomStore()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store',
    [pytest.lazy_fixture('memory_room_store'), pytest.lazy_fixture('redis_room_store')],
)
async def test_save_and_load(room_store: RoomStore):
    await room_store.write_room_data('room_id', [VALID_TOKEN])
    assert (await room_store.read_room_data('room_id')) == [asdict(VALID_TOKEN)]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store',
    [pytest.lazy_fixture('memory_room_store'), pytest.lazy_fixture('redis_room_store')],
)
async def test_list_all_keys(room_store: RoomStore):
    await room_store.write_room_data('room-id-1', [])
    await room_store.write_room_data('room-id-2', [])
    assert (await async_collect(room_store.get_all_room_ids())) == [
        'room-id-1',
        'room-id-2',
    ]
