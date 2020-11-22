from __future__ import annotations

import asyncio
import json
import logging
from typing import (
    Protocol,
    Optional,
    List,
    Dict,
    AsyncIterator,
    Union,
    Callable,
    TypeVar,
    Awaitable,
    Coroutine,
    Any,
)
from dataclasses import asdict, dataclass, field
from uuid import uuid4

from aioredis import Redis, MultiExecError
from dacite import WrongTypeError, MissingValueError, from_dict

from .game_components import Token, Ping

MAX_UPDATE_RETRIES = 3

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


def _to_entities(room_id: str, raw_entities: List[dict]) -> List[Union[Ping, Token]]:
    room = []
    for raw_entity in raw_entities:
        try:
            entity: Union[Ping, Token]
            if (
                raw_entity.get('type') == 'character'
                or raw_entity.get('type') == 'floor'
            ):
                entity = from_dict(data_class=Token, data=raw_entity)
            else:
                entity = from_dict(data_class=Ping, data=raw_entity)

            room.append(entity)
        except (WrongTypeError, MissingValueError, TypeError):
            # Don't raise here. Loading a room minus any tokens that
            # have been corrupted is still valuable.
            logger.exception(
                f'Corrupted room {room_id}',
                extra={'invalid_token': raw_entity},
                exc_info=True,
            )
    return room


@dataclass
class MemoryRoomStorage:
    rooms: Dict[str, EntityList] = field(default_factory=dict)
    locks: Dict[str, bool] = field(default_factory=dict)


class MemoryRoomStore(RoomStore):
    def __init__(self, storage: MemoryRoomStorage) -> None:
        self.storage = storage

    async def read(self, room_id: str) -> Optional[List[Union[Token, Ping]]]:
        return self.storage.rooms.get(room_id, None)

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        for key in self.storage.rooms.keys():
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
        if self.storage.locks.get(room_id, False):
            raise TransactionFailed(f'Unable to get room lock for room {room_id}')

        self.storage.locks[room_id] = True

        initial_entities = await self.read(room_id)
        try:
            result = await mutate(initial_entities)
            self.storage.rooms[room_id] = result.entities
        finally:
            self.storage.locks[room_id] = False
        return result


LOCK_EXPIRATION_SECS = 10


def _room_key(room_id: str) -> str:
    return f'room:{room_id}'


# language=lua
RELEASE_LOCK = """
local lock_key = KEYS[1]
local lock_value = ARGV[1]

if redis.call("get", lock_key) == lock_value then
    return redis.call("del", lock_key)
else
    return redis.error_reply("Unable to free lock because it is already expired")
end
"""


async def create_redis_room_store(redis: Redis) -> RedisRoomStore:
    release_lock_sha = await redis.script_load(RELEASE_LOCK)
    return RedisRoomStore(redis, release_lock_sha)


class RedisRoomStore(RoomStore):
    def __init__(self, redis: Redis, release_lock_sha: str):
        self.redis = redis
        self._release_lock_sha = release_lock_sha

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        # A cursor of '0' tells redis.scan to start at the beginning
        cursor = b'0'
        while cursor:
            cursor, keys = await self.redis.scan(cursor, 'room:*')
            for key in keys:
                yield str(key[len('room:') :], 'utf-8')

    async def read(self, room_id: str) -> Optional[List[Union[Token, Ping]]]:
        data = await self.redis.get(_room_key(room_id), encoding='utf-8')
        return _to_entities(room_id, json.loads(data)) if data else None

    async def apply_mutation(
        self,
        room_id: str,
        mutate: Callable[[Optional[EntityList]], Awaitable[MutationResultType]],
    ) -> MutationResultType:
        success = False
        retry_count = 0
        lock_key = f'room-lock:{room_id}'
        lock_value = uuid4().bytes
        while not success and retry_count < MAX_UPDATE_RETRIES:
            success = await self.redis.set(
                lock_key,
                lock_value,
                exist=self.redis.SET_IF_NOT_EXIST,
                expire=LOCK_EXPIRATION_SECS,
            )
            retry_count += 1
            if not success:
                await asyncio.sleep(0.1)

        if not success:
            raise TransactionFailed('Unable to acquire room lock')

        transaction_success = False
        try:
            entities = await self.read(room_id)
            result = await mutate(entities)

            tr = self.redis.multi_exec()
            tr.set(
                _room_key(room_id), json.dumps(list(map(asdict, result.entities))),
            )
            tr.evalsha(self._release_lock_sha, keys=[lock_key], args=[lock_value])

            try:
                await tr.execute()
                transaction_success = True
            except MultiExecError as e:
                raise TransactionFailed from e

            return result
        finally:
            if not transaction_success:
                await self.redis.evalsha(
                    self._release_lock_sha, keys=[lock_key], args=[lock_value]
                )
