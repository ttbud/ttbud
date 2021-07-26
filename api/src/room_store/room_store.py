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
)

from src.api.api_structures import Request, Action
from src.game_components import Token, Ping

MAX_LOCK_RETRIES = 3
COMPACTION_INTERVAL_SECONDS = 10 * 60
COMPACTION_LOCK_EXPIRATION_SECONDS = COMPACTION_INTERVAL_SECONDS * 2


class CorruptedRoomException(Exception):
    pass


class TransactionFailedException(Exception):
    pass


class UnexpectedReplacementId(Exception):
    pass


class UnexpectedReplacementToken(Exception):
    pass


@dataclass
class RoomChangeEvent:
    request_id: Optional[str]
    entities: List[Union[Token, Ping]]


@dataclass
class ReplacementData:
    actions: Iterable[Action]
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

    async def write_if_missing(self, room_id: str, actions: Iterable[Action]) -> None:
        """
        Create a room and add the actions to it if the room is not already in
        the room store.
        :param room_id: The ID of the room
        :param actions: The actions to write to the room if it is not in the room store
        """
        ...

    async def add_request(self, room_id: str, request: Request) -> None:
        ...

    async def acquire_replacement_lock(
        self, compaction_id: str, force: bool = False
    ) -> bool:
        ...

    async def read_for_replacement(self, room_id: str) -> ReplacementData:
        ...

    async def delete(self, room_id: str, replacer_id: str, replace_token: Any) -> None:
        ...

    async def replace(
        self,
        room_id: str,
        actions: List[Action],
        replace_token: Any,
        compaction_id: str,
    ) -> None:
        ...

    async def get_room_idle_seconds(self, room_id: str) -> int:
        """
        :param room_id: The ID of the room to get the idle time of
        :raises: NoSuchRoomError if the room does not exist
        :return: Number of seconds since the room was read or written to by a user
        """
        ...
