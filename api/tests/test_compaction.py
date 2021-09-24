from datetime import timedelta

import pytest
import time_machine

from src.api.api_structures import (
    Request,
    UpsertAction,
)
from src.colors import colors
from src.compaction import Compactor, ARCHIVE_WHEN_IDLE_SECONDS
from src.game_components import Token
from src.room_store.memory_room_archive import MemoryRoomArchive
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.room_store.room_archive import RoomArchive
from src.room_store.room_store import RoomStore
from tests.static_fixtures import (
    TEST_ROOM_ID,
    VALID_TOKEN,
    VALID_REQUEST,
    DELETE_REQUEST,
    VALID_MOVE_REQUEST,
    UPDATED_TOKEN,
)

TEST_COMPACTOR_ID = 'compactor_1'


pytestmark = pytest.mark.asyncio


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
        assert await room_archive.read(TEST_ROOM_ID) == [UpsertAction(UPDATED_TOKEN)]
