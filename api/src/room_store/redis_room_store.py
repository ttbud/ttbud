from __future__ import annotations

import asyncio
import json
import logging
from asyncio import Task
from dataclasses import asdict, dataclass, field
from typing import (
    List,
    AsyncGenerator,
    AsyncIterator,
    Iterator,
    Iterable,
    Dict,
    Any,
    Union,
    Callable,
)

from aioredis import Redis, ResponseError
from aioredis.client import Script
from dacite import from_dict

from src.api.api_structures import Request, Action, UpsertAction, DeleteAction
from src.apm import instrument
from src.room_store.room_store import (
    RoomStore,
    ReplacementData,
    UnexpectedReplacementId,
    COMPACTION_LOCK_EXPIRATION_SECONDS,
    UnexpectedReplacementToken,
)

logger = logging.getLogger(__name__)

NO_REQUEST_ID = "NO_REQUEST_ID"
REPLACEMENT_KEY = 'replacement_lock'
ERR_INVALID_COMPACTION_KEY = "INVALID_COMPACTION_KEY"
ERR_INVALID_ROOM_LENGTH = "INVALID_ROOM_LENGTH"


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


def _room_key(room_id: str) -> str:
    return f'room:{room_id}'


def _channel_key(room_id: str) -> str:
    return f'channel:{room_id}'


@dataclass
class ChangeListener:
    output_queues: List[asyncio.Queue[Union[Request, BaseException]]]
    task: asyncio.Task
    subscribe_started: asyncio.Future[None] = field(default_factory=asyncio.Future)


class RedisRoomStore(RoomStore):
    def __init__(
        self,
        redis: Redis,
        lreplace: Script,
        delete_room: Script,
    ):
        self._redis = redis
        self._lreplace = lreplace
        self._delete_room = delete_room
        self._listeners_by_room_id: Dict[str, ChangeListener] = dict()

    async def _listen_for_changes(self, room_id: str) -> None:
        listener = self._listeners_by_room_id[room_id]
        queues = listener.output_queues

        async with self._redis.pubsub() as channel:
            await channel.subscribe(_channel_key(room_id))

            listener.subscribe_started.set_result(None)
            async for event in channel.listen():
                if event['type'] == 'message':
                    update = from_dict(Request, json.loads(event['data']))
                    for q in queues:
                        await q.put(update)

    def _make_done_callback(self, room_id: str) -> Callable[[Task], None]:
        def done_callback(task: Task) -> None:
            listener = self._listeners_by_room_id.get(room_id)
            if listener and listener.output_queues:
                for q in listener.output_queues:
                    exception = task.exception() or StopAsyncIteration()
                    q.put_nowait(exception)

        return done_callback

    async def changes(self, room_id: str) -> AsyncIterator[Request]:
        listener = self._listeners_by_room_id.get(room_id)
        if not listener:
            task = asyncio.create_task(
                self._listen_for_changes(room_id),
                name=f'Redis Pubsub {room_id}',
            )
            task.add_done_callback(self._make_done_callback(room_id))
            listener = ChangeListener([], task)
            self._listeners_by_room_id[room_id] = listener

        queue: asyncio.Queue[Union[Request, BaseException]] = asyncio.Queue()
        listener.output_queues.append(queue)

        # This function shouldn't return until we've actually started listening
        # for changes so that consumers know they're not missing events once they
        # get the iterator back
        await listener.subscribe_started

        return self._room_changes(room_id, queue)

    async def _room_changes(
        self, room_id: str, queue: asyncio.Queue[Union[Request, BaseException]]
    ) -> AsyncIterator[Request]:
        try:
            while True:
                item = await queue.get()
                if isinstance(item, Request):
                    yield item
                else:
                    raise item
        finally:
            listener = self._listeners_by_room_id[room_id]
            listener.output_queues.remove(queue)
            if not listener.output_queues:
                listener.task.cancel()
                if room_id in self._listeners_by_room_id:
                    del self._listeners_by_room_id[room_id]

    async def get_all_room_ids(self) -> AsyncGenerator[str, None]:
        async for room_key in self._redis.scan_iter('room:*'):
            yield room_key.removeprefix('room:')

    @instrument
    async def room_exists(self, room_id: str) -> bool:
        return bool(await self._redis.exists(_room_key(room_id)))

    @instrument
    async def read(self, room_id: str) -> Iterable[Action]:
        data = await self._redis.lrange(_room_key(room_id), 0, -1)
        return _to_actions(data)

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
            await pipeline.publish(_channel_key(room_id), json.dumps(asdict(request)))
            await pipeline.execute()

    @instrument
    async def acquire_replacement_lock(
        self, replacer_id: str, force: bool = False
    ) -> bool:
        return await self._redis.set(
            REPLACEMENT_KEY,
            replacer_id,
            ex=COMPACTION_LOCK_EXPIRATION_SECONDS,
            nx=not force,
        )

    @instrument
    async def read_for_replacement(self, room_id: str) -> ReplacementData:
        updates = await self._redis.lrange(_room_key(room_id), 0, -1)
        actions = [action for action in _to_actions(updates)]
        return ReplacementData(actions, len(updates))

    @instrument
    async def replace(
        self, room_id: str, actions: List[Action], replace_token: Any, replacer_id: str
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
            await self._delete_room(
                keys=[_room_key(room_id), REPLACEMENT_KEY],
                args=[replacer_id, replace_token],
            )
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


async def create_redis_room_store(redis: Redis) -> RedisRoomStore:
    lreplace = redis.register_script(_LREPLACE)
    delete_room = redis.register_script(_DELETE_ROOM)

    return RedisRoomStore(redis, lreplace, delete_room)


def _to_actions(raw_updates: List[str]) -> Iterator[Action]:
    for raw_update_group in raw_updates:
        update_group = json.loads(raw_update_group)
        for update in update_group:
            action = update['action']
            # Older version uses "update" or "create" instead of upsert
            if action in ['upsert', 'update', 'create']:
                update['action'] = 'upsert'
                yield from_dict(UpsertAction, update)
            elif action == 'delete':
                yield from_dict(DeleteAction, update)
