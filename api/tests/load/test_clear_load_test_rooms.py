import dataclasses

import pytest

from load.clear_load_test_rooms import clear_load_test_rooms
from load.locustfile import LOAD_TEST_ICON_ID
from src.api.api_structures import Request, UpsertAction
from src.game_components import IconTokenContents
from src.room_store.memory_room_store import MemoryRoomStore, MemoryRoomStorage
from src.room_store.room_store import RoomStore
from tests.static_fixtures import VALID_REQUEST, VALID_TOKEN

pytestmark = pytest.mark.asyncio


@pytest.fixture
def room_store():
    return MemoryRoomStore(MemoryRoomStorage())


async def test_cleanup(room_store: RoomStore):
    await room_store.add_request('regular-room-id', VALID_REQUEST)
    await room_store.add_request(
        'load-room-id',
        Request(
            'request-id',
            actions=[
                UpsertAction(
                    dataclasses.replace(
                        VALID_TOKEN, contents=IconTokenContents(LOAD_TEST_ICON_ID)
                    )
                )
            ],
        ),
    )

    await clear_load_test_rooms(room_store)
    assert await room_store.room_exists('regular-room-id') is True
    assert await room_store.room_exists('load-room-id') is False
