import time
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
)

from src.game_components import Token, Ping
from src.room_store.room_store import (
    EntityList,
    RoomStore,
    MutationResultType,
    TransactionFailedException,
    LOCK_EXPIRATION_SECS,
)


@dataclass
class MemoryRoomStorage:
    rooms_by_id: Dict[str, EntityList] = field(default_factory=dict)
    lock_expiration_times: Dict[str, float] = field(default_factory=dict)


class MemoryRoomStore(RoomStore):
    def __init__(self, storage: MemoryRoomStorage) -> None:
        self.storage = storage

    async def read(self, room_id: str) -> Optional[List[Union[Token, Ping]]]:
        return self.storage.rooms_by_id.get(room_id, None)

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        for key in self.storage.rooms_by_id.keys():
            yield key

    async def apply_mutation(
        self,
        room_id: str,
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
                self.storage.rooms_by_id[room_id] = result.entities
            else:
                raise TransactionFailedException('Lock expired')
        finally:
            del self.storage.lock_expiration_times[room_id]
        return result
