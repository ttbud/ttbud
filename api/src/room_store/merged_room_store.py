from __future__ import annotations

import logging
from typing import (
    List,
    AsyncGenerator,
    AsyncIterator,
    Iterable,
    Any,
    Optional,
)

from src.api.api_structures import Request, Action
from src.room_store.room_archive import RoomArchive
from src.room_store.room_store import (
    RoomStore,
    ReplacementData,
)

logger = logging.getLogger(__name__)


class MergedRoomStore(RoomStore):
    def __init__(
        self,
        room_store: RoomStore,
        room_archive: RoomArchive,
    ):
        self._room_store = room_store
        self._room_archive = room_archive

    async def changes(self, room_id: str) -> AsyncIterator[Request]:
        return await self._room_store.changes(room_id)

    async def get_all_room_ids(self) -> AsyncGenerator[str, None]:
        """
        Yield the IDs of all rooms in both the room store and the room archive.
        Room IDs may appear in both and will be yielded twice.
        """
        async for room_id in self._room_store.get_all_room_ids():
            yield room_id

        async for room_id in self._room_archive.get_all_room_ids():
            yield room_id

    async def room_exists(self, room_id: str) -> bool:
        return await self._room_store.room_exists(
            room_id
        ) or await self._room_archive.room_exists(room_id)

    async def _load_into_redis(self, room_id: str) -> None:
        if not await self._room_store.room_exists(
            room_id
        ) and await self._room_archive.room_exists(room_id):
            await self._room_store.write_if_missing(
                room_id, await self._room_archive.read(room_id)
            )

    async def read(self, room_id: str) -> Iterable[Action]:
        await self._load_into_redis(room_id)
        return await self._room_store.read(room_id)

    async def add_request(self, room_id: str, request: Request) -> None:
        await self._room_store.add_request(room_id, request)

    async def write_if_missing(self, room_id: str, actions: Iterable[Action]) -> None:
        await self._room_store.write_if_missing(room_id, actions)

    async def acquire_replacement_lock(
        self, replacer_id: str, force: bool = False
    ) -> bool:
        return await self._room_store.acquire_replacement_lock(replacer_id, force=force)

    async def read_for_replacement(self, room_id: str) -> ReplacementData:
        await self._load_into_redis(room_id)
        return await self._room_store.read_for_replacement(room_id)

    async def replace(
        self, room_id: str, actions: List[Action], replace_token: Any, replacer_id: str
    ) -> None:
        await self._room_store.replace(room_id, actions, replace_token, replacer_id)

    async def delete(self, room_id: str, replacer_id: str, replace_token: Any) -> None:
        await self._room_store.delete(room_id, replacer_id, replace_token)

    async def get_room_idle_seconds(self, room_id: str) -> int:
        return await self._room_store.get_room_idle_seconds(room_id)

    async def seconds_since_last_activity(self) -> Optional[int]:
        return await self._room_store.seconds_since_last_activity()
