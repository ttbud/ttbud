from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator, AsyncIterator, Iterable
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass, field
from typing import (
    Any,
)

from redis.asyncio.client import Redis
from redis.commands.core import AsyncScript
from redis.exceptions import ResponseError
from src.api.api_structures import Action, Request
from src.apm import instrument
from src.room_store.common import ARCHIVE_WHEN_IDLE_SECONDS, NoSuchRoomError
from src.room_store.json_to_actions import json_to_actions
from src.room_store.redis_room_listener import (
    RedisRoomListener,
    create_redis_room_listener,
)
from src.room_store.room_store import (
    COMPACTION_LOCK_EXPIRATION_SECONDS,
    ReplacementData,
    UnexpectedReplacementId,
    UnexpectedReplacementToken,
)

logger = logging.getLogger(__name__)

NO_REQUEST_ID = 'NO_REQUEST_ID'
REPLACEMENT_KEY = 'replacement_lock'
ERR_INVALID_COMPACTION_KEY = 'INVALID_COMPACTION_KEY'
ERR_INVALID_ROOM_LENGTH = 'INVALID_ROOM_LENGTH'


# language=lua
_APPEND_TO_ROOM = """
local room_key = KEYS[1]
local channel_key = KEYS[2]
local room_update = ARGV[1]
local publish_value = ARGV[2]

redis.call("rpush", room_key, room_update)
redis.call("publish", channel_key, publish_value)
"""

# language=lua
_LREPLACE = f"""
local room_key = KEYS[1]
local compaction_key = KEYS[2]
local replace_item = ARGV[1]
local replace_until = ARGV[2]
local compactor_id = ARGV[3]

if redis.call("get", compaction_key) == compactor_id then
    redis.call("ltrim", room_key, replace_until, -1)
    redis.call("lpush", room_key, replace_item)
else
    return redis.error_reply("{ERR_INVALID_COMPACTION_KEY}")
end
"""

# language=lua
_DELETE_ROOM = f"""
local room_key = KEYS[1]
local compaction_key = KEYS[2]
local compactor_id = ARGV[1]
local expected_length = tonumber(ARGV[2])

if redis.call("get", compaction_key) ~= compactor_id then
    return redis.error_reply("{ERR_INVALID_COMPACTION_KEY}")
end

if redis.call("llen", room_key) ~= expected_length then
    return redis.error_reply("{ERR_INVALID_ROOM_LENGTH}")
end

redis.call("del", room_key)
"""

# language=lua
_WRITE_IF_MISSING = """
local room_key = KEYS[1]
local room_data = ARGV[1]

if redis.call("exists", room_key) == 0 then
    redis.call("rpush", room_key, room_data)
end
"""


def _room_key(room_id: str) -> str:
    return f'room:{room_id}'


def _last_activity_key(room_id: str) -> str:
    return f'last-room-activity:{room_id}'


@dataclass
class ChangeListener:
    output_queues: list[asyncio.Queue[Request | BaseException]]
    task: asyncio.Task
    subscribe_started: asyncio.Future[None] = field(default_factory=asyncio.Future)


class RedisRoomStore:
    def __init__(
        self,
        redis: Redis,
        room_listener: RedisRoomListener,
        lreplace: AsyncScript,
        delete_room: AsyncScript,
        write_if_missing: AsyncScript,
    ):
        self._redis = redis
        self._room_listener = room_listener
        self._lreplace = lreplace
        self._delete_room = delete_room
        self._write_if_missing = write_if_missing
        self.changes = self._room_listener.changes

    async def get_all_room_ids(self) -> AsyncGenerator[str, None]:
        async for room_key in self._redis.scan_iter('room:*'):
            yield room_key.decode().removeprefix('room:')

    @instrument
    async def room_exists(self, room_id: str) -> bool:
        return bool(await self._redis.exists(_room_key(room_id)))

    @instrument
    async def read(self, room_id: str) -> Iterable[Action]:
        async with self._redis.pipeline() as pipeline:
            await pipeline.lrange(_room_key(room_id), 0, -1)
            await pipeline.set(
                _last_activity_key(room_id),
                str(int(time.time())),
                ex=ARCHIVE_WHEN_IDLE_SECONDS * 2,
            )
            data, _ = await pipeline.execute()
            return json_to_actions(data)

    @instrument
    async def add_request(self, room_id: str, request: Request) -> None:
        async with self._redis.pipeline() as pipeline:
            await pipeline.rpush(
                _room_key(room_id),
                json.dumps(
                    [
                        asdict(action)
                        for action in request.actions
                        if action.action != 'ping'
                    ]
                ),
            )
            await self._room_listener.publish(room_id, request, pipeline)
            await pipeline.set(
                _last_activity_key(room_id),
                str(int(time.time())),
                ex=ARCHIVE_WHEN_IDLE_SECONDS * 2,
            )
            await pipeline.execute()

    @instrument
    async def write_if_missing(self, room_id: str, actions: Iterable[Action]) -> None:
        async with self._redis.pipeline() as pipeline:
            await self._write_if_missing(
                client=pipeline,
                keys=[_room_key(room_id)],
                args=[json.dumps(list(map(asdict, actions)))],
            )
            await pipeline.set(
                _last_activity_key(room_id),
                str(int(time.time())),
                ex=ARCHIVE_WHEN_IDLE_SECONDS * 2,
            )
            await pipeline.execute()

    @instrument
    async def acquire_replacement_lock(
        self, replacer_id: str, force: bool = False
    ) -> bool:
        return bool(
            await self._redis.set(
                REPLACEMENT_KEY,
                replacer_id,
                ex=COMPACTION_LOCK_EXPIRATION_SECONDS,
                nx=not force,
            )
        )

    @instrument
    async def read_for_replacement(self, room_id: str) -> ReplacementData:
        updates = await self._redis.lrange(_room_key(room_id), 0, -1)
        actions = [action for action in json_to_actions(updates)]
        return ReplacementData(actions, len(updates))

    @instrument
    async def replace(
        self, room_id: str, actions: list[Action], replace_token: Any, replacer_id: str
    ) -> None:
        try:
            await self._lreplace(
                keys=[_room_key(room_id), REPLACEMENT_KEY],
                args=[
                    json.dumps(list(map(asdict, actions))),
                    replace_token,
                    replacer_id,
                ],
            )
        except ResponseError as e:
            # The error message is only exposed as the first element in the args
            # tuple :(
            (msg,) = e.args

            if msg == ERR_INVALID_COMPACTION_KEY:
                raise UnexpectedReplacementId() from e
            else:
                raise

    @instrument
    async def delete(self, room_id: str, replacer_id: str, replace_token: Any) -> None:
        try:
            async with self._redis.pipeline() as pipeline:
                await self._delete_room(
                    keys=[_room_key(room_id), REPLACEMENT_KEY],
                    args=[replacer_id, replace_token],
                )
                await pipeline.delete(_last_activity_key(room_id))
                await pipeline.execute()
        except ResponseError as e:
            # The error message is only exposed as the first element in the args
            # tuple :(
            (msg,) = e.args

            if msg == ERR_INVALID_ROOM_LENGTH:
                raise UnexpectedReplacementToken() from e
            elif msg == ERR_INVALID_COMPACTION_KEY:
                raise UnexpectedReplacementId() from e
            else:
                raise

    @instrument
    async def get_room_idle_seconds(self, room_id: str) -> int:
        async with self._redis.pipeline() as pipeline:
            await pipeline.exists(_room_key(room_id))
            await pipeline.get(_last_activity_key(room_id))
            room_exists, last_edited = await pipeline.execute()
            if not room_exists:
                raise NoSuchRoomError

        # If a room does not have a last edited time, add one here so the room
        # can be moved to the archive later
        if last_edited is None:
            await self._redis.set(
                _last_activity_key(room_id),
                str(int(time.time())),
                ex=ARCHIVE_WHEN_IDLE_SECONDS * 2,
            )
            return 0
        else:
            return int(time.time()) - int(last_edited)

    @instrument
    async def seconds_since_last_activity(self) -> int | None:
        most_recent_activity = 0
        async for entry in self._redis.scan_iter(match='last-room-activity:*'):
            value = await self._redis.get(entry)
            if value is None:
                continue
            last_activity_time = int(value)
            if last_activity_time > most_recent_activity:
                most_recent_activity = last_activity_time
        if most_recent_activity == 0:
            return None
        return int(time.time() - most_recent_activity)


@asynccontextmanager
async def create_redis_room_store(redis: Redis) -> AsyncIterator[RedisRoomStore]:
    lreplace = redis.register_script(_LREPLACE)
    delete_room = redis.register_script(_DELETE_ROOM)
    write_if_missing = redis.register_script(_WRITE_IF_MISSING)

    async with create_redis_room_listener(redis) as listener:
        store = RedisRoomStore(redis, listener, lreplace, delete_room, write_if_missing)
        try:
            yield store
        finally:
            await listener.reset()
