from src.room_store.merged_room_store import MergedRoomStore
from src.room_store.room_archive import RoomArchive
from tests.static_fixtures import VALID_ACTION, TEST_ROOM_ID


async def test_archived_room_is_loaded(
    merged_room_store: MergedRoomStore, memory_room_archive: RoomArchive
) -> None:
    await memory_room_archive.write(TEST_ROOM_ID, [VALID_ACTION])
    assert await merged_room_store.read(TEST_ROOM_ID) == [VALID_ACTION]
