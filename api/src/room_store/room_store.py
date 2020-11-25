from __future__ import annotations

import logging
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
logger = logging.getLogger(__name__)


class MutationResult(Protocol):
    entities: EntityList


MutationResultType = TypeVar('MutationResultType', bound=MutationResult)


class InvalidState(Exception):
    pass


class TransactionFailed(Exception):
    pass


class RoomStore(Protocol):
    def get_all_room_ids(self) -> AsyncIterator[str]:
        ...

    async def read(self, room_id: str) -> Optional[EntityList]:
        ...

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
        """
        Make a change to the specified room

        :param room_id: The unique room id
        :param mutate: A function that takes the current state of the room and
        returns the MutationResult. *Note* This function must be pure, as
        it may be called multiple times in the event of a transaction conflict
        :return: The result returned by the mutate function
        """
        ...
