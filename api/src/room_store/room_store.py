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
    Any,
    Iterator,
)

from src.api.api_structures import Request, Action
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


@dataclass
class ReplacementData:
    actions: Iterator[Action]
    replace_token: Any


class RoomStore(Protocol):
    def changes(self, room_id: str) -> Awaitable[AsyncIterator[Request]]:
        ...

    def get_all_room_ids(self) -> AsyncIterator[str]:
        ...

    async def room_exists(self, room_id: str) -> bool:
        ...

    async def read(self, room_id: str) -> Iterable[Action]:
        ...

    async def add_request(self, room_id: str, request: Request) -> None:
        ...

    async def read_for_replacement(self, room_id: str) -> ReplacementData:
        ...

    async def replace(self, room_id: str, request: Request, replace_token: Any) -> None:
        ...
