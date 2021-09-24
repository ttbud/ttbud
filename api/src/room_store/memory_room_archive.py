from typing import Dict, AsyncIterator, Iterable

from src.api.api_structures import Action
from src.room_store.common import NoSuchRoomError
from src.room_store.room_archive import RoomArchive


class MemoryRoomArchive(RoomArchive):
    def __init__(self) -> None:
        self.storage: Dict[str, Iterable[Action]] = {}

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        for room_id in list(self.storage.keys()):
            yield room_id

    async def room_exists(self, room_id: str) -> bool:
        return room_id in self.storage.keys()

    async def read(self, room_id: str) -> Iterable[Action]:
        actions = self.storage.get(room_id)
        if actions is None:
            raise NoSuchRoomError
        return actions

    async def write(self, room_id: str, data: Iterable[Action]) -> None:
        self.storage[room_id] = data

    async def delete(self, room_id: str) -> None:
        self.storage.pop(room_id, None)
