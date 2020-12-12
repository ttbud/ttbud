from __future__ import annotations

from dataclasses import dataclass
from typing import (
    Protocol,
    Optional,
    List,
    AsyncIterator,
    Union,
    Callable,
    TypeVar,
    Awaitable,
    Coroutine,
    Any,
)

from src.game_components import Token, Ping

MAX_LOCK_RETRIES = 3
LOCK_EXPIRATION_SECS = 10

EntityList = List[Union[Ping, Token]]


class MutationResult(Protocol):
    entities: EntityList


MutationResultType = TypeVar('MutationResultType', bound=MutationResult)


class CorruptedRoomException(Exception):
    pass


class TransactionFailedException(Exception):
    pass


@dataclass
class RoomChangeEvent:
    request_id: Optional[str]
    entities: List[Union[Token, Ping]]


class RoomStore(Protocol):
    def changes(self, room_id: str) -> Awaitable[AsyncIterator[RoomChangeEvent]]:
        ...

    def get_all_room_ids(self) -> AsyncIterator[str]:
        ...

    async def read(self, room_id: str) -> Optional[EntityList]:
        ...

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
        """
        Make a change to the specified room

        :param room_id: The unique room id
        :param request_id: The request id associated with this change
        :param mutate: A function that takes the current state of the room and
        returns the MutationResult. *Note* This function must be pure, as
        it may be called multiple times in the event of a transaction conflict
        :return: The result returned by the mutate function
        """
        ...
