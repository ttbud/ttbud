import uuid

from load.locustfile import LOAD_TEST_ICON_ID
from src.game_components import IconTokenContents
from src.room_store.room_store import RoomStore


async def clear_load_test_rooms(room_store: RoomStore) -> None:
    replacer_id = str(uuid.uuid4())
    await room_store.force_acquire_replacement_lock(replacer_id)

    async for room_id in room_store.get_all_room_ids():
        actions = await room_store.read(room_id)
        first = next(iter(actions))
        if (
            first.action == 'upsert'
            and isinstance(first.data.contents, IconTokenContents)
            and first.data.contents.icon_id == LOAD_TEST_ICON_ID
        ):
            await room_store.delete(room_id, replacer_id)
