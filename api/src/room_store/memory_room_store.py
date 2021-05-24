from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from copy import copy
from dataclasses import dataclass, field
from typing import (
    Dict,
    List,
    AsyncIterator,
    AsyncGenerator,
    DefaultDict,
    Iterable,
    Any,
    Optional,
)

from src.api.api_structures import Request, Action
from src.room_store.room_store import (
    RoomStore,
    ReplacementData,
    UnexpectedReplacementId,
    COMPACTION_LOCK_EXPIRATION_SECONDS,
)

logger = logging.getLogger(__name__)


@dataclass
class MemoryRoomStorage:
    rooms_by_id: DefaultDict[str, List[Action]] = field(
        default_factory=lambda: defaultdict(list)
    )


@dataclass
class ReplacementLock:
    key: str
    expire_time: float


class MemoryRoomStore(RoomStore):
    def __init__(self, storage: MemoryRoomStorage) -> None:
        self.storage = storage
        self._changes: Dict[str, List[asyncio.Queue]] = defaultdict(list)
        self._replacement_lock: Optional[ReplacementLock] = None

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
        return copy(self.storage.rooms_by_id.get(room_id, []))

    async def _write(self, room_id: str, updates: Iterable[Action]) -> None:
        # Yield the event loop at least once so writing is truly async
        await asyncio.sleep(0)
        for update in updates:
            self.storage.rooms_by_id[room_id].append(update)

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        # Make a copy so that deletions don't break iteration
        for key in list(self.storage.rooms_by_id.keys()):
            yield key

    async def room_exists(self, room_id: str) -> bool:
        return room_id in self.storage.rooms_by_id

    async def _publish(self, room_id: str, request: Request) -> None:
        for q in self._changes[room_id]:
            await q.put(request)

    async def acquire_replacement_lock(
        self, replacement_id: str, force: bool = False
    ) -> bool:
        lock_already_held = (
            self._replacement_lock
            and self._replacement_lock.key != replacement_id
            and self._replacement_lock.expire_time >= time.monotonic()
        )
        if not force and lock_already_held:
            return False

        self._replacement_lock = ReplacementLock(
            replacement_id, time.monotonic() + COMPACTION_LOCK_EXPIRATION_SECONDS
        )
        return True

    async def force_acquire_replacement_lock(self, replacement_id: str) -> None:
        self._replacement_lock = ReplacementLock(
            replacement_id, time.monotonic() + COMPACTION_LOCK_EXPIRATION_SECONDS
        )

    async def read_for_replacement(self, room_id: str) -> ReplacementData:
        actions = copy(self.storage.rooms_by_id[room_id])
        return ReplacementData(actions, len(actions))

    async def replace(
        self,
        room_id: str,
        actions: List[Action],
        replace_token: Any,
        replacement_id: str,
    ) -> None:
        if self._has_replacement_lock(replacement_id):
            self.storage.rooms_by_id[room_id][0:replace_token] = actions
        else:
            raise UnexpectedReplacementId()

    async def delete(self, room_id: str, replacement_id: str) -> None:
        if self._has_replacement_lock(replacement_id):
            if self.storage.rooms_by_id.get(room_id):
                del self.storage.rooms_by_id[room_id]
        else:
            raise UnexpectedReplacementId()

    def _has_replacement_lock(self, replacement_id: str) -> bool:
        return (
            self._replacement_lock is not None
            and self._replacement_lock.key == replacement_id
            and self._replacement_lock.expire_time >= time.monotonic()
        )
