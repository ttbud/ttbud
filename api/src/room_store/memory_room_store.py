from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import (
    Dict,
    List,
    AsyncIterator,
    AsyncGenerator,
    DefaultDict,
    Iterable,
)

from src.api.api_structures import Request, Action
from src.room_store.room_store import RoomStore

logger = logging.getLogger(__name__)


@dataclass
class MemoryRoomStorage:
    rooms_by_id: DefaultDict[str, List[Action]] = field(
        default_factory=lambda: defaultdict(list)
    )


class MemoryRoomStore(RoomStore):
    def __init__(self, storage: MemoryRoomStorage) -> None:
        self.storage = storage
        self._changes: Dict[str, List[asyncio.Queue]] = defaultdict(list)

    async def changes(self, room_id: str) -> AsyncGenerator[Request, None]:
        queue: asyncio.Queue[Request] = asyncio.Queue()
        self._changes[room_id].append(queue)
        return self._room_changes(room_id, queue)

    async def _room_changes(
        self, room_id: str, queue: asyncio.Queue[Request]
    ) -> AsyncGenerator[Request, None]:
        try:
            while True:
                request = await queue.get()
                yield request
        finally:
            self._changes[room_id].remove(queue)

    async def add_request(self, room_id: str, request: Request) -> None:
        await self._write(
            room_id, filter(lambda x: x.action != 'ping', request.actions)
        )
        await self._publish(room_id, request)

    async def read(self, room_id: str) -> Iterable[Action]:
        # Yield the event loop at least once so reading is truly async
        await asyncio.sleep(0)
        return self.storage.rooms_by_id.get(room_id, [])

    async def _write(self, room_id: str, updates: Iterable[Action]) -> None:
        # Yield the event loop at least once so writing is truly async
        await asyncio.sleep(0)
        for update in updates:
            self.storage.rooms_by_id[room_id].append(update)

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        for key in self.storage.rooms_by_id.keys():
            yield key

    async def _publish(self, room_id: str, request: Request) -> None:
        for q in self._changes[room_id]:
            await q.put(request)
