from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from collections.abc import AsyncGenerator, AsyncIterator, Iterable
from copy import copy
from dataclasses import dataclass, field
from typing import (
    Any,
)

from src.api.api_structures import Action, Request
from src.room_store.common import NoSuchRoomError
from src.room_store.room_store import (
    COMPACTION_LOCK_EXPIRATION_SECONDS,
    ReplacementData,
    RoomStore,
    UnexpectedReplacementId,
    UnexpectedReplacementToken,
)

logger = logging.getLogger(__name__)


@dataclass
class MemoryRoomStorage:
    rooms_by_id: defaultdict[str, list[Action]] = field(
        default_factory=lambda: defaultdict(list)
    )
    last_room_activity_by_id: defaultdict[str, int] = field(
        default_factory=lambda: defaultdict(lambda: int(time.time()))
    )


@dataclass
class ReplacementLock:
    key: str
    expire_time: float


class MemoryRoomStore(RoomStore):
    def __init__(self, storage: MemoryRoomStorage):
        self.storage = storage
        self._changes: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._replacement_lock: ReplacementLock | None = None

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
        self.storage.last_room_activity_by_id[room_id] = int(time.time())
        return copy(self.storage.rooms_by_id.get(room_id, []))

    async def _write(self, room_id: str, updates: Iterable[Action]) -> None:
        # Yield the event loop at least once so writing is truly async
        await asyncio.sleep(0)
        self.storage.last_room_activity_by_id[room_id] = int(time.time())
        for update in updates:
            self.storage.rooms_by_id[room_id].append(update)

    async def write_if_missing(self, room_id: str, actions: Iterable[Action]) -> None:
        # Yield the event loop at least once so writing is truly async
        await asyncio.sleep(0)
        if not self.storage.rooms_by_id.get(room_id):
            self.storage.rooms_by_id[room_id] = list(actions)

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
        actions: list[Action],
        replace_token: Any,
        replacement_id: str,
    ) -> None:
        if self._has_replacement_lock(replacement_id):
            self.storage.rooms_by_id[room_id][0:replace_token] = actions
        else:
            raise UnexpectedReplacementId()

    async def delete(
        self, room_id: str, replacement_id: str, replace_token: Any
    ) -> None:
        if not self._has_replacement_lock(replacement_id):
            raise UnexpectedReplacementId()

        room = self.storage.rooms_by_id.get(room_id)
        if room is None or len(room) != replace_token:
            raise UnexpectedReplacementToken()

        del self.storage.rooms_by_id[room_id]
        self.storage.last_room_activity_by_id.pop(room_id, None)

    def _has_replacement_lock(self, replacement_id: str) -> bool:
        return (
            self._replacement_lock is not None
            and self._replacement_lock.key == replacement_id
            and self._replacement_lock.expire_time >= time.monotonic()
        )

    async def get_room_idle_seconds(self, room_id: str) -> int:
        if room_id not in self.storage.rooms_by_id:
            raise NoSuchRoomError
        return int(time.time()) - self.storage.last_room_activity_by_id[room_id]

    async def seconds_since_last_activity(self) -> int | None:
        most_recent_activity = 0
        for _, last_activity_time in self.storage.last_room_activity_by_id.items():
            if last_activity_time > most_recent_activity:
                most_recent_activity = last_activity_time
        if most_recent_activity == 0:
            return None
        return int(time.time() - most_recent_activity)
