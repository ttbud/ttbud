import pytest

from src.api.api_structures import (
    Request,
    UpsertAction,
)
from src.colors import colors
from src.compaction import Compactor
from src.game_components import Token
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.room_store.room_store import RoomStore
from tests.static_fixtures import (
    TEST_ROOM_ID,
    VALID_TOKEN,
    VALID_REQUEST,
    DELETE_REQUEST, VALID_MOVE_REQUEST, UPDATED_TOKEN,
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
        color_rgb=colors[1]
    )
    await room_store.add_request(TEST_ROOM_ID, VALID_REQUEST)
    await room_store.add_request(TEST_ROOM_ID, Request('new_request', [UpsertAction(green_token)]))
    await room_store.add_request(TEST_ROOM_ID, DELETE_REQUEST)
    await room_store.acquire_replacement_lock(TEST_COMPACTOR_ID)
    await compactor._compact_room(TEST_ROOM_ID)
    assert await room_store.read(TEST_ROOM_ID) == [UpsertAction(green_token)]
