import asyncio
from datetime import timedelta
from typing import Callable, List

import pytest
import time_machine
from pytest_lazyfixture import lazy_fixture
from redis.asyncio.client import Redis

from src.api.api_structures import Request, Action
from src.room_store.common import NoSuchRoomError
from src.room_store.room_store import (
    RoomStore,
    UnexpectedReplacementId,
    COMPACTION_LOCK_EXPIRATION_SECONDS,
    UnexpectedReplacementToken,
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
    VALID_MOVE_REQUEST,
)


def any_room_store(func: Callable) -> Callable:
    return pytest.mark.parametrize(
        'room_store',
        [
            lazy_fixture('memory_room_store'),
            lazy_fixture('redis_room_store'),
            lazy_fixture('merged_room_store'),
        ],
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


async def test_change_notification_error(
    redis: Redis, redis_room_store: RoomStore
) -> None:
    """
    Verify that errors thrown while processing pub/sub messages bubble out to consumers

    This test only runs against the redis implementation because it's impossible to
    trigger an error in the memory implementation
    """

    changes = await redis_room_store.changes(TEST_ROOM_ID)
    sub_task = asyncio.create_task(async_collect(changes, count=1))

    await redis.publish(f'channel:{TEST_ROOM_ID}', 'INVALID REQUEST')
    with pytest.raises(BaseException):
        await sub_task


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
    replace_data = await room_store.read_for_replacement(TEST_ROOM_ID)
    await room_store.delete(TEST_ROOM_ID, 'replacer_id', replace_data.replace_token)
    assert await room_store.room_exists(TEST_ROOM_ID) is False


@any_room_store
async def test_delete_invalid_replacer_id(room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.acquire_replacement_lock('replacer_id')
    replace_data = await room_store.read_for_replacement(TEST_ROOM_ID)
    with pytest.raises(UnexpectedReplacementId):
        await room_store.delete(
            TEST_ROOM_ID, 'invalid_replacer_id', replace_data.replace_token
        )


@any_room_store
async def test_delete_outdated_token(room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.acquire_replacement_lock('replacer_id')
    replace_data = await room_store.read_for_replacement(TEST_ROOM_ID)

    # Add another request to the list after we've read
    await room_store.add_request(TEST_ROOM_ID, VALID_MOVE_REQUEST)

    with pytest.raises(UnexpectedReplacementToken):
        await room_store.delete(TEST_ROOM_ID, 'replacer_id', replace_data.replace_token)


@any_room_store
async def test_delete_with_expired_replacer_id(room_store: RoomStore) -> None:
    with time_machine.travel('1970-01-01', tick=False) as traveller:
        await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
        await room_store.acquire_replacement_lock('replacer_id')
        replace_data = await room_store.read_for_replacement(TEST_ROOM_ID)

        # Move forward in time to expire the replacer_id
        traveller.shift(timedelta(seconds=COMPACTION_LOCK_EXPIRATION_SECONDS + 1))
        with pytest.raises(UnexpectedReplacementId):
            await room_store.delete(
                TEST_ROOM_ID, 'replacer_id', replace_data.replace_token
            )


@any_room_store
async def test_force_acquire_room_lock(room_store: RoomStore) -> None:
    await room_store.acquire_replacement_lock('old-replacer-id')
    await room_store.acquire_replacement_lock('new-replacer-id', force=True)
    replace_data = await room_store.read_for_replacement(TEST_ROOM_ID)

    await room_store.delete(TEST_ROOM_ID, 'new-replacer-id', replace_data.replace_token)

    with pytest.raises(UnexpectedReplacementId):
        await room_store.delete(
            TEST_ROOM_ID, 'old-replacer-id', replace_data.replace_token
        )


@any_room_store
async def test_get_room_idle_seconds(room_store: RoomStore) -> None:
    with time_machine.travel('1970-01-01', tick=False) as traveller:
        await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
        traveller.shift(timedelta(seconds=100))
        assert await room_store.get_room_idle_seconds(TEST_ROOM_ID) == 100


@any_room_store
async def test_get_nonexistent_room_idle_seconds(room_store: RoomStore) -> None:
    with pytest.raises(NoSuchRoomError):
        await room_store.get_room_idle_seconds('nonexistent_room')


@any_room_store
async def test_write_if_missing(room_store: RoomStore) -> None:
    await room_store.write_if_missing(TEST_ROOM_ID, [VALID_ACTION])
    assert list(await room_store.read(TEST_ROOM_ID)) == [VALID_ACTION]


@any_room_store
async def test_write_if_missing_does_not_overwrite(room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.write_if_missing(TEST_ROOM_ID, [ANOTHER_VALID_ACTION])
    assert list(await room_store.read(TEST_ROOM_ID)) == [VALID_ACTION]


@any_room_store
async def test_get_last_activity_time(room_store: RoomStore) -> None:
    with time_machine.travel('1970-01-01', tick=False) as traveller:
        await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
        traveller.shift(timedelta(seconds=100))
        await room_store.add_request(TEST_ROOM_ID, VALID_MOVE_REQUEST)
        traveller.shift(timedelta(seconds=500))
        assert await room_store.seconds_since_last_activity() == 500


@any_room_store
async def test_unknown_last_activity(room_store: RoomStore) -> None:
    assert await room_store.seconds_since_last_activity() is None
