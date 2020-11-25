# language=lua
import asyncio
import json
import random
from dataclasses import asdict
from typing import AsyncIterator, Optional, List, Union, Callable, Awaitable
from uuid import uuid4

from aioredis import Redis, ReplyError
from dacite import from_dict, WrongTypeError, MissingValueError

from src.game_components import Token, Ping
from src.room_store.room_store import (
    RoomStore,
    EntityList,
    MutationResultType,
    MAX_LOCK_RETRIES,
    LOCK_EXPIRATION_SECS,
    TransactionFailed,
    logger,
)

# language=lua
_SET_AND_RELEASE_LOCK = """
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
_RELEASE_LOCK = """
local lock_key = KEYS[1]
local lock_value = ARGV[1]

if redis.call("get", lock_key) == lock_value then
    redis.call("del", lock_key)
else
    return redis.error_reply("Unable to set value, key lock has expired")
end
"""


def _room_key(room_id: str) -> str:
    return f'room:{room_id}'


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
        # We use a simplified locking mechanism that does not guarantee
        # exclusive locks across redis failovers. However, since the resource
        # we are locking is on the same redis server as is holding the lock, if
        # we still have the lock when we write, the room data is guaranteed to
        # be the same as when we read it when we commit the mutation.
        #
        # If we start using redis clusters with multiple masters this will no longer
        # hold true, and we will have to use a more complicated locking scheme.
        #
        # See https://redis.io/commands/setnx#design-pattern-locking-with-codesetnxcode

        success = False
        retry_count = 0
        lock_key = f'lock:room:{room_id}'
        lock_value = uuid4().bytes

        while not success and retry_count < MAX_LOCK_RETRIES:
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


async def create_redis_room_store(redis: Redis) -> RedisRoomStore:
    [set_and_release_lock_sha, release_lock_sha] = await asyncio.gather(
        redis.script_load(_SET_AND_RELEASE_LOCK), redis.script_load(_RELEASE_LOCK)
    )
    return RedisRoomStore(redis, set_and_release_lock_sha, release_lock_sha)


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
