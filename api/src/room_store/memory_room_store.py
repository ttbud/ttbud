from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import (
    Dict,
    Optional,
    List,
    Union,
    AsyncIterator,
    Callable,
    Awaitable,
    Coroutine,
    Any,
    AsyncGenerator,
)

from src.game_components import Token, Ping
from src.room_store.room_store import (
    EntityList,
    RoomStore,
    MutationResultType,
    TransactionFailedException,
    LOCK_EXPIRATION_SECS,
    RoomChangeEvent,
)


logger = logging.getLogger(__name__)


@dataclass
class MemoryRoomStorage:
    rooms_by_id: Dict[str, EntityList] = field(default_factory=dict)
    lock_expiration_times: Dict[str, float] = field(default_factory=dict)


class MemoryRoomStore(RoomStore):
    def __init__(self, storage: MemoryRoomStorage) -> None:
        self.storage = storage
        self._changes: Dict[str, List[asyncio.Queue]] = defaultdict(list)

    async def changes(self, room_id: str) -> AsyncGenerator[RoomChangeEvent, None]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        self._changes[room_id].append(queue)
        return self._room_changes(room_id, queue)

    async def _room_changes(
        self, room_id: str, queue: asyncio.Queue[str]
    ) -> AsyncGenerator[RoomChangeEvent, None]:
        try:
            while True:
                request_id = await queue.get()
                entities = await self.read(room_id)
                if entities is None:
                    logger.error(
                        'Received update notification for nonexistent room',
                        extra={'request_id': request_id, 'room_id': room_id},
                    )
                else:
                    yield RoomChangeEvent(request_id, entities)
        finally:
            self._changes[room_id].remove(queue)

    async def read(self, room_id: str) -> Optional[List[Union[Token, Ping]]]:
        # Yield the event loop at least once so reading is truly async
        await asyncio.sleep(0)
        return self.storage.rooms_by_id.get(room_id, None)

    async def _write(self, room_id: str, entities: EntityList) -> None:
        # Yield the event loop at least once so writing is truly async
        await asyncio.sleep(0)
        self.storage.rooms_by_id[room_id] = entities

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        for key in self.storage.rooms_by_id.keys():
            yield key

    async def apply_mutation(
        self,
        room_id: str,
        request_id: Optional[str],
        mutate: Callable[
            [Optional[EntityList]],
            Union[
                Awaitable[MutationResultType], Coroutine[Any, Any, MutationResultType]
            ],
        ],
    ) -> MutationResultType:
        if self.storage.lock_expiration_times.get(room_id, False) is not False:
            raise TransactionFailedException(
                f'Unable to get room lock for room {room_id}'
            )

        self.storage.lock_expiration_times[room_id] = time.time() + LOCK_EXPIRATION_SECS

        initial_entities = await self.read(room_id)
        try:
            result = await mutate(initial_entities)
            if time.time() < self.storage.lock_expiration_times[room_id]:
                await self._write(room_id, result.entities)
                await self._publish(room_id, request_id)
            else:
                raise TransactionFailedException('Lock expired')
        finally:
            del self.storage.lock_expiration_times[room_id]
        return result

    async def _publish(self, room_id: str, request_id: Optional[str]) -> None:
        for q in self._changes[room_id]:
            await q.put(request_id)
