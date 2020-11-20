import asyncio
from asyncio import Future
from typing import List, Union, Callable

import fakeredis.aioredis
import pytest

from src.async_collect import async_collect
from src.game_components import Ping, Token
from src.game_state_server import BareUpdateResult
from src.room_store import (
    MemoryRoomStore,
    RedisRoomStore,
    RoomStore,
    TransactionFailed,
    MutationResult,
)

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
def redis_room_store_factory(redis):
    return lambda: RedisRoomStore(redis)


@pytest.fixture
def redis_room_store(redis_room_store_factory):
    return redis_room_store_factory()


@pytest.fixture
def memory_room_storage():
    return {}


@pytest.fixture
def memory_room_store_factory(memory_room_storage):
    return lambda: MemoryRoomStore(memory_room_storage)


@pytest.fixture
def memory_room_store(memory_room_store_factory):
    return memory_room_store_factory()


async def mutate_to(entities: List[Union[Ping, Token]]) -> MutationResult:
    return BareUpdateResult(entities)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store',
    [pytest.lazy_fixture('memory_room_store'), pytest.lazy_fixture('redis_room_store')],
)
async def test_mutate_and_read(room_store: RoomStore):
    result = await room_store.apply_mutation(
        'room_id', lambda _: mutate_to([VALID_TOKEN])
    )
    assert result.entities == [VALID_TOKEN]
    assert (await room_store.read('room_id')) == [VALID_TOKEN]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store',
    [pytest.lazy_fixture('memory_room_store'), pytest.lazy_fixture('redis_room_store')],
)
async def test_list_all_keys(room_store: RoomStore):
    await room_store.apply_mutation('room-id-1', lambda _: mutate_to([]))
    await room_store.apply_mutation('room-id-2', lambda _: mutate_to([]))

    assert (await async_collect(room_store.get_all_room_ids())) == [
        'room-id-1',
        'room-id-2',
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store_factory',
    [
        pytest.lazy_fixture('memory_room_store_factory'),
        pytest.lazy_fixture('redis_room_store_factory'),
    ],
)
async def test_transaction_contention(room_store_factory: Callable[[], RoomStore]):
    room_store_1 = room_store_factory()
    room_store_2 = room_store_factory()

    future: Future = Future()
    task = asyncio.create_task(
        room_store_1.apply_mutation('room-id-1', lambda _: future)
    )
    # Have to yield to the event loop here to get the above task to run up
    # until it waits for our mutate function to complete
    await asyncio.sleep(0)

    # Now that room_store_1 has started the transaction, but is stuck waiting for our
    # mutate function to complete it, run another mutation to change the same room
    await room_store_2.apply_mutation('room-id-1', lambda _: mutate_to([]))

    # We've changed the room, now allow the first room store to attempt to finish
    # its transaction. It should fail because room_store_2 got there first
    future.set_result(BareUpdateResult([]))
    with pytest.raises(TransactionFailed):
        await task
