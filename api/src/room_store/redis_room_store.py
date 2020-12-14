from __future__ import annotations

import asyncio
import json
import logging
import random
from dataclasses import asdict, dataclass, field
from typing import (
    Optional,
    List,
    Union,
    Callable,
    Awaitable,
    AsyncGenerator,
    Dict,
    AsyncIterator,
)
from uuid import uuid4

from aioredis import Redis, ReplyError

from src.colors import Color
from src.game_components import Token, Ping, TextTokenContents, IconTokenContents
from src.room_store.room_store import (
    RoomStore,
    EntityList,
    MutationResultType,
    MAX_LOCK_RETRIES,
    LOCK_EXPIRATION_SECS,
    TransactionFailedException,
    CorruptedRoomException,
    RoomChangeEvent,
)

logger = logging.getLogger(__name__)

NO_REQUEST_ID = "NO_REQUEST_ID"

# language=lua
_SET_AND_RELEASE_LOCK = """
local lock_key = KEYS[1]
local room_key = KEYS[2]
local channel_key = KEYS[3]
local lock_value = ARGV[1]
local value = ARGV[2]
local request_key = ARGV[3]

if redis.call("get", lock_key) == lock_value then
    redis.call("set", room_key, value)
    redis.call("publish", channel_key, request_key)
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


def _channel_key(room_id: str) -> str:
    return f'channel:{room_id}'


@dataclass
class ChangeListener:
    output_queues: List[asyncio.Queue[RoomChangeEvent]]
    task: asyncio.Task
    subscribe_started: asyncio.Future[None] = field(default_factory=asyncio.Future)


class RedisRoomStore(RoomStore):
    def __init__(
        self, redis: Redis, set_and_release_lock_sha: str, release_lock_sha: str
    ):
        self._redis = redis
        self._set_and_release_lock_sha = set_and_release_lock_sha
        self._release_lock_sha = release_lock_sha
        self._listeners_by_room_id: Dict[str, ChangeListener] = dict()

    async def _listen_for_changes(self, room_id: str) -> None:
        listener = self._listeners_by_room_id[room_id]
        queues = listener.output_queues
        channel = (await self._redis.subscribe(_channel_key(room_id)))[0]
        listener.subscribe_started.set_result(None)
        try:
            while await channel.wait_message():
                request_id = (await channel.get()).decode('utf-8')
                entities = await self.read(room_id)
                if entities is None:
                    logger.error(
                        'Received update notification for nonexistent room',
                        extra={'request_id': request_id, 'room_id': room_id},
                    )
                else:
                    for q in queues:
                        await q.put(
                            RoomChangeEvent(
                                request_id if request_id != NO_REQUEST_ID else None,
                                entities,
                            )
                        )
        finally:
            if not self._redis.closed:
                await self._redis.unsubscribe(_channel_key(room_id))

    async def changes(self, room_id: str) -> AsyncIterator[RoomChangeEvent]:
        listener = self._listeners_by_room_id.get(room_id)
        if not listener:
            listener = ChangeListener(
                [],
                asyncio.create_task(
                    self._listen_for_changes(room_id), name=f'Redis Pubsub {room_id}'
                ),
            )
            self._listeners_by_room_id[room_id] = listener

        # This function shouldn't return until we've actually started listening
        # for changes so that consumers know they're not missing events once they
        # get the iterator back
        await listener.subscribe_started

        queue: asyncio.Queue[RoomChangeEvent] = asyncio.Queue()
        listener.output_queues.append(queue)

        return self._room_changes(room_id, queue)

    async def _room_changes(
        self, room_id: str, queue: asyncio.Queue[RoomChangeEvent]
    ) -> AsyncIterator[RoomChangeEvent]:
        try:
            while True:
                yield await queue.get()
        finally:
            listener = self._listeners_by_room_id[room_id]
            listener.output_queues.remove(queue)
            if not listener.output_queues:
                listener.task.cancel()
                if room_id in self._listeners_by_room_id:
                    del self._listeners_by_room_id[room_id]

    async def get_all_room_ids(self) -> AsyncGenerator[str, None]:
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
        request_id: Optional[str],
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
            raise TransactionFailedException('Unable to acquire room lock')

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
                keys=[lock_key, _room_key(room_id), _channel_key(room_id)],
                args=[
                    lock_value,
                    room_json,
                    request_id if request_id else NO_REQUEST_ID,
                ],
            )
        except ReplyError as e:
            raise TransactionFailedException from e

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
            if raw_entity['type'] in ('character', 'floor'):
                raw_contents = raw_entity['contents']
                raw_color = raw_entity.get('color_rgb')
                color = (
                    Color(
                        red=raw_color['red'],
                        green=raw_color['green'],
                        blue=raw_color['blue'],
                    )
                    if raw_color
                    else None
                )
                contents: Union[TextTokenContents, IconTokenContents] = (
                    TextTokenContents(raw_contents['text'])
                    if 'text' in raw_contents
                    else IconTokenContents(raw_contents['icon_id'])
                )
                entity = Token(
                    id=raw_entity['id'],
                    type=raw_entity['type'],
                    contents=contents,
                    start_x=raw_entity['start_x'],
                    start_y=raw_entity['start_y'],
                    start_z=raw_entity['start_z'],
                    end_x=raw_entity['end_x'],
                    end_y=raw_entity['end_y'],
                    end_z=raw_entity['end_z'],
                    color_rgb=color,
                )
            elif raw_entity['type'] == 'ping':
                entity = Ping(
                    id=raw_entity['id'],
                    type='ping',
                    x=raw_entity['x'],
                    y=raw_entity['y'],
                )
            else:
                raise TypeError(f'Invalid entity type {raw_entity["type"]}')

            room.append(entity)
        except (KeyError, TypeError) as e:
            logger.exception(
                f'Corrupted room {room_id}',
                extra={'invalid_token': raw_entity},
                exc_info=True,
            )
            raise CorruptedRoomException(f'{room_id} is corrupted') from e
    return room
