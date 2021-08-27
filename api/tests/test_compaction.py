import asyncio
from asyncio import Future
from typing import Any

import pytest
from pytest_mock import MockerFixture

from src.api.api_structures import (
    Request,
    UpsertAction,
)
from src.colors import colors
from src.compaction import Compactor
from src.game_components import Token
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.room_store.room_store import RoomStore, ReplacementData
from tests.static_fixtures import (
    TEST_ROOM_ID,
    VALID_TOKEN,
    VALID_REQUEST,
    DELETE_REQUEST,
    VALID_MOVE_REQUEST,
    UPDATED_TOKEN,
    ANOTHER_VALID_REQUEST,
)

TEST_COMPACTOR_ID = 'compactor_1'


pytestmark = pytest.mark.asyncio


@pytest.fixture
def room_store() -> RoomStore:
    return MemoryRoomStore(MemoryRoomStorage())


@pytest.fixture
def compactor(room_store: RoomStore) -> Compactor:
    return Compactor(room_store, TEST_COMPACTOR_ID)


async def test_delete(compactor: Compactor, room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.add_request(TEST_ROOM_ID, DELETE_REQUEST)
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    assert await room_store.read(TEST_ROOM_ID) == []


async def test_move(compactor: Compactor, room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.add_request(TEST_ROOM_ID, VALID_MOVE_REQUEST)
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    assert await room_store.read(TEST_ROOM_ID) == [UpsertAction(UPDATED_TOKEN)]


async def test_token_data_intact(compactor: Compactor, room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    assert await room_store.read(TEST_ROOM_ID) == [UpsertAction(VALID_TOKEN)]


async def test_color_persistence(compactor: Compactor, room_store: RoomStore) -> None:
    green_token = Token(
        id='new_token_id',
        type='character',
        contents=VALID_TOKEN.contents,
        start_x=2,
        start_y=2,
        start_z=2,
        end_x=3,
        end_y=3,
        end_z=3,
        color_rgb=colors[1],
    )
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.add_request(
        TEST_ROOM_ID, Request('new_request', [UpsertAction(green_token)])
    )
    await room_store.add_request(TEST_ROOM_ID, DELETE_REQUEST)
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    assert await room_store.read(TEST_ROOM_ID) == [UpsertAction(green_token)]


async def test_deletes_empty_rooms(compactor: Compactor, room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.add_request(TEST_ROOM_ID, DELETE_REQUEST)
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    assert await room_store.room_exists(TEST_ROOM_ID) is False


async def test_handles_conflicts_on_delete(
    compactor: Compactor, room_store: RoomStore, mocker: MockerFixture
) -> None:
    """
    Verify that when a new request is added between the time that the compactor reads
    the room that would compact to an empty room, the compactor does not delete the room
    and instead just compacts the requests it knew about
    """
    read_started: Future[None] = Future()
    gate: Future[None] = Future()
    old_read = room_store.read_for_replacement

    # Create a read_for_replacement that doesn't return until we allow it to so we
    # can guarantee conflicts
    async def gated_read_for_replacement(*args: Any, **kwargs: Any) -> ReplacementData:
        result = await old_read(*args, **kwargs)
        read_started.set_result(None)
        await gate
        return result

    room_store.__setattr__('read_for_replacement', gated_read_for_replacement)

    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    # Create a room that should compact to nothing
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.add_request(TEST_ROOM_ID, DELETE_REQUEST)

    # Start compaction and wait until the read has started
    compact_task = asyncio.create_task(compactor._compact_room(TEST_ROOM_ID))
    await read_started
    # Force a conflict by adding a request after the compactor has read from the store
    await room_store.add_request(TEST_ROOM_ID, ANOTHER_VALID_REQUEST)
    # Allow the compactor to finish
    gate.set_result(None)
    await compact_task
    assert await room_store.read(TEST_ROOM_ID) == ANOTHER_VALID_REQUEST.actions
