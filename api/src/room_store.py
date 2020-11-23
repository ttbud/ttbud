from __future__ import annotations

import asyncio
import json
import logging
import random
import time
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

from aioredis import Redis, ReplyError
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
            raise TransactionFailed(f'Unable to get room lock for room {room_id}')

        self.storage.lock_expiration_times[room_id] = time.time() + LOCK_EXPIRATION_SECS

        initial_entities = await self.read(room_id)
        try:
            result = await mutate(initial_entities)
            if time.time() < self.storage.lock_expiration_times[room_id]:
                self.storage.rooms_by_id[room_id] = result.entities
            else:
                raise TransactionFailed('Lock expired')
        finally:
            del self.storage.lock_expiration_times[room_id]
        return result


LOCK_EXPIRATION_SECS = 10


def _room_key(room_id: str) -> str:
    return f'room:{room_id}'


# language=lua
SET_AND_RELEASE_LOCK = """
local lock_key = KEYS[1]
local key = KEYS[2]
local lock_value = ARGV[1]
local value = ARGV[2]

if redis.call("get", lock_key) == lock_value then
    redis.call("set", key, value)
    redis.call("del", lock_key)
else
    return redis.error_reply("Unable to set value, lock has expired")
end
"""

# language=lua
RELEASE_LOCK = """
local lock_key = KEYS[1]
local lock_value = ARGV[1]

if redis.call("get", lock_key) == lock_value then
    redis.call("del", lock_key)
else
    return redis.error_reply("Unable to set value, key lock has expired")
end
"""


async def create_redis_room_store(redis: Redis) -> RedisRoomStore:
    [set_and_release_lock_sha, release_lock_sha] = await asyncio.gather(
        redis.script_load(SET_AND_RELEASE_LOCK), redis.script_load(RELEASE_LOCK)
    )
    return RedisRoomStore(redis, set_and_release_lock_sha, release_lock_sha)


class RedisRoomStore(RoomStore):
    def __init__(
        self, redis: Redis, set_and_release_lock_sha: str, release_lock_sha: str
    ):
        self._redis = redis
        self._set_and_release_lock_sha = set_and_release_lock_sha
        self._release_lock_sha = release_lock_sha

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        # A cursor of '0' tells redis.scan to start at the beginning
        cursor = b'0'
        while cursor:
            cursor, keys = await self._redis.scan(cursor, 'room:*')
            for key in keys:
                yield str(key[len('room:') :], 'utf-8')

    async def read(self, room_id: str) -> Optional[List[Union[Token, Ping]]]:
        data = await self._redis.get(_room_key(room_id), encoding='utf-8')
        return _to_entities(room_id, json.loads(data)) if data else None

    async def apply_mutation(
        self,
        room_id: str,
        mutate: Callable[[Optional[EntityList]], Awaitable[MutationResultType]],
    ) -> MutationResultType:
        # We use a simplified locking mechanism that only works for redis
        # running as a single node. It allows us to only change the room if the
        # lock hasn't expired. If we start using a redis cluster we will have
        # to use a different strategy
        # See https://redis.io/commands/setnx#design-pattern-locking-with-codesetnxcode

        success = False
        retry_count = 0
        lock_key = f'lock:room:{room_id}'
        lock_value = uuid4().bytes

        while not success and retry_count < MAX_UPDATE_RETRIES:
            success = await self._redis.set(
                lock_key,
                lock_value,
                exist=self._redis.SET_IF_NOT_EXIST,
                expire=LOCK_EXPIRATION_SECS,
            )
            retry_count += 1
            if not success:
                # Sleep a random amount of time to avoid a thundering herd problem
                await asyncio.sleep(random.uniform(0.05, 0.15))

        if not success:
            raise TransactionFailed('Unable to acquire room lock')

        # If mutation fails, release the lock and re-raise the original exception
        try:
            entities = await self.read(room_id)
            result = await mutate(entities)
            room_json = json.dumps(list(map(asdict, result.entities)))
        except Exception as e:
            await self._redis.evalsha(
                self._release_lock_sha, keys=[lock_key], args=[lock_value]
            )
            raise e

        # Otherwise, release the lock while setting the new room state
        try:
            await self._redis.evalsha(
                self._set_and_release_lock_sha,
                keys=[lock_key, _room_key(room_id)],
                args=[lock_value, room_json],
            )
        except ReplyError as e:
            raise TransactionFailed from e

        return result
