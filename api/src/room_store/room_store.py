from __future__ import annotations

from dataclasses import dataclass
from typing import (
    Protocol,
    Optional,
    List,
    AsyncIterator,
    Union,
    Awaitable,
    Iterable,
)

from src.api.api_structures import Request, Update
from src.game_components import Token, Ping

MAX_LOCK_RETRIES = 3
LOCK_EXPIRATION_SECS = 10


class CorruptedRoomException(Exception):
    pass


class TransactionFailedException(Exception):
    pass


@dataclass
class RoomChangeEvent:
    request_id: Optional[str]
    entities: List[Union[Token, Ping]]


class RoomStore(Protocol):
    def changes(self, room_id: str) -> Awaitable[AsyncIterator[Request]]:
        ...

    def get_all_room_ids(self) -> AsyncIterator[str]:
        ...

    async def read(self, room_id: str) -> Iterable[Update]:
        ...

    async def add_update(self, room_id: str, request: Request) -> None:
        """

        :rtype: object
        """
        ...
