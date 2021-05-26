import uuid

from load.constants import LOAD_TEST_ICON_ID
from src.game_components import IconTokenContents
from src.room_store.room_store import RoomStore


async def clear_load_test_rooms(room_store: RoomStore) -> None:
    replacer_id = str(uuid.uuid4())
    await room_store.acquire_replacement_lock(replacer_id, force=True)

    async for room_id in room_store.get_all_room_ids():
        replace_data = await room_store.read_for_replacement(room_id)
        first = next(iter(replace_data.actions), None)
        if (
            first
            and first.action == 'upsert'
            and isinstance(first.data.contents, IconTokenContents)
            and first.data.contents.icon_id == LOAD_TEST_ICON_ID
        ):
            await room_store.delete(room_id, replacer_id, replace_data.replace_token)
