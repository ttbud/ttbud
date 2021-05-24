import dataclasses

import pytest

from load.clear_load_test_rooms import clear_load_test_rooms
from load.constants import LOAD_TEST_ICON_ID
from src.api.api_structures import Request, UpsertAction
from src.game_components import IconTokenContents
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.room_store.room_store import RoomStore
from tests.static_fixtures import VALID_REQUEST, VALID_TOKEN

pytestmark = pytest.mark.asyncio

LOAD_TEST_REQUEST = Request(
    'request-id',
    actions=[
        UpsertAction(
            dataclasses.replace(
                VALID_TOKEN, contents=IconTokenContents(LOAD_TEST_ICON_ID)
            )
        )
    ],
)


@pytest.fixture
def room_store() -> RoomStore:
    return MemoryRoomStore(MemoryRoomStorage())


async def test_cleanup(room_store: RoomStore) -> None:
    await room_store.add_request('regular-room-id', VALID_REQUEST)
    await room_store.add_request('load-room-id', LOAD_TEST_REQUEST)

    await clear_load_test_rooms(room_store)
    assert await room_store.room_exists('regular-room-id') is True
    assert await room_store.room_exists('load-room-id') is False


async def test_cleanup_empty_room(room_store: RoomStore) -> None:
    """Verify that rooms with no actions do no break clear_load_test_rooms"""
    await room_store.add_request('empty-room-id', Request('request-id', []))
    await room_store.add_request('load-room-id', LOAD_TEST_REQUEST)

    await clear_load_test_rooms(room_store)
    assert await room_store.room_exists('load-room-id') is False
