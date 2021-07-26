from typing import Protocol, AsyncIterator, Iterable

from src.api.api_structures import Action


class RoomArchive(Protocol):
    def get_all_room_ids(self) -> AsyncIterator[str]:
        ...

    async def room_exists(self, room_id: str) -> bool:
        ...

    async def read(self, room_id: str) -> Iterable[Action]:
        ...

    async def write(self, room_id: str, data: Iterable[Action]) -> None:
        ...

    async def delete(self, room_id: str) -> None:
        ...
