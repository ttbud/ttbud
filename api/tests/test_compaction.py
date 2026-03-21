from datetime import timedelta

import pytest
import time_machine

from src.api.api_structures import (
    Request,
    SetGridTypeAction,
    UpsertAction,
)
from src.colors import colors
from src.compaction import ARCHIVE_WHEN_IDLE_SECONDS, Compactor
from src.game_components import Token
from src.room_store.memory_room_archive import MemoryRoomArchive
from src.room_store.memory_room_store import MemoryRoomStorage, MemoryRoomStore
from src.room_store.room_archive import RoomArchive
from src.room_store.room_store import RoomStore
from tests.static_fixtures import (
    DELETE_REQUEST,
    TEST_ROOM_ID,
    UPDATED_TOKEN,
    VALID_MOVE_REQUEST,
    VALID_REQUEST,
    VALID_TOKEN,
)

TEST_COMPACTOR_ID = 'compactor_1'


@pytest.fixture
def room_store() -> RoomStore:
    return MemoryRoomStore(MemoryRoomStorage())


@pytest.fixture
def room_archive() -> RoomArchive:
    return MemoryRoomArchive()


@pytest.fixture
def compactor(room_store: RoomStore, room_archive: RoomArchive) -> Compactor:
    return Compactor(room_store, room_archive, TEST_COMPACTOR_ID)


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
    assert await room_store.read(TEST_ROOM_ID) == [
        UpsertAction(UPDATED_TOKEN),
        SetGridTypeAction(data='square'),
    ]


async def test_token_data_intact(compactor: Compactor, room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    assert await room_store.read(TEST_ROOM_ID) == [
        UpsertAction(VALID_TOKEN),
        SetGridTypeAction(data='square'),
    ]


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
    assert await room_store.read(TEST_ROOM_ID) == [
        UpsertAction(green_token),
        SetGridTypeAction(data='square'),
    ]


async def test_deletes_empty_rooms(compactor: Compactor, room_store: RoomStore) -> None:
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.add_request(TEST_ROOM_ID, DELETE_REQUEST)
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    assert not await room_store.room_exists(TEST_ROOM_ID)


async def test_archives_old_room(
    compactor: Compactor, room_store: RoomStore, room_archive: RoomArchive
) -> None:
    with time_machine.travel('1970-01-01') as traveller:
        await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
        traveller.shift(timedelta(seconds=ARCHIVE_WHEN_IDLE_SECONDS + 1))
        await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
        await compactor._compact_room(TEST_ROOM_ID)
        assert not await room_store.room_exists(TEST_ROOM_ID)
        assert await room_archive.room_exists(TEST_ROOM_ID)


async def test_deletes_old_empty_room(
    compactor: Compactor, room_store: RoomStore, room_archive: RoomArchive
) -> None:
    with time_machine.travel('1970-01-01') as traveller:
        await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
        await room_store.add_request(TEST_ROOM_ID, DELETE_REQUEST)
        traveller.shift(timedelta(seconds=ARCHIVE_WHEN_IDLE_SECONDS + 1))
        await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
        await compactor._compact_room(TEST_ROOM_ID)
        assert not await room_store.room_exists(TEST_ROOM_ID)
        assert not await room_archive.room_exists(TEST_ROOM_ID)


async def test_compacts_room_before_archiving(
    compactor: Compactor, room_store: RoomStore, room_archive: RoomArchive
) -> None:
    with time_machine.travel('1970-01-01') as traveller:
        await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
        await room_store.add_request(TEST_ROOM_ID, VALID_MOVE_REQUEST)
        traveller.shift(timedelta(seconds=ARCHIVE_WHEN_IDLE_SECONDS + 1))
        await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
        await compactor._compact_room(TEST_ROOM_ID)
        assert not await room_store.room_exists(TEST_ROOM_ID)
        assert await room_archive.read(TEST_ROOM_ID) == [
            UpsertAction(UPDATED_TOKEN),
            SetGridTypeAction(data='square'),
        ]


async def test_deletes_room_with_only_set_grid_type_action(
    compactor: Compactor, room_store: RoomStore
) -> None:
    """A room with no tokens is deleted even if it has a grid type set."""
    await room_store.add_request(
        TEST_ROOM_ID, Request('hex_request_id', [SetGridTypeAction(data='hex')])
    )
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    assert not await room_store.room_exists(TEST_ROOM_ID)


async def test_set_grid_type_preserved(
    compactor: Compactor, room_store: RoomStore
) -> None:
    """A hex grid type is preserved after compaction when the room has tokens."""
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.add_request(
        TEST_ROOM_ID, Request('hex_request_id', [SetGridTypeAction(data='hex')])
    )
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    compacted = await room_store.read(TEST_ROOM_ID)
    assert SetGridTypeAction(data='hex') in compacted


async def test_set_grid_type_last_write_wins(
    compactor: Compactor, room_store: RoomStore
) -> None:
    """When multiple SetGridTypeActions appear, the last one should win."""
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.add_request(
        TEST_ROOM_ID, Request('hex_request_id', [SetGridTypeAction(data='hex')])
    )
    await room_store.add_request(
        TEST_ROOM_ID, Request('square_request_id', [SetGridTypeAction(data='square')])
    )
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    compacted = await room_store.read(TEST_ROOM_ID)
    assert SetGridTypeAction(data='square') in compacted
    assert SetGridTypeAction(data='hex') not in compacted


async def test_set_grid_type_persisted_in_archive(
    compactor: Compactor, room_store: RoomStore, room_archive: RoomArchive
) -> None:
    """Non-default grid type should be preserved when a room is archived."""
    with time_machine.travel('1970-01-01') as traveller:
        await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
        await room_store.add_request(
            TEST_ROOM_ID, Request('hex_request_id', [SetGridTypeAction(data='hex')])
        )
        traveller.shift(timedelta(seconds=ARCHIVE_WHEN_IDLE_SECONDS + 1))
        await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
        await compactor._compact_room(TEST_ROOM_ID)
        assert not await room_store.room_exists(TEST_ROOM_ID)
        archived = await room_archive.read(TEST_ROOM_ID)
        assert SetGridTypeAction(data='hex') in archived
